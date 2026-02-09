"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Minus,
  Pause,
  PhoneOff,
  Play,
  Plus,
  RotateCcw,
  Target,
  Volume2,
  X,
  Zap
} from "lucide-react";
import {
  createSession,
  updateSession,
  logSessionEvent,
  logDistraction,
} from "@/lib/analytics";
import { reverseGeocode } from "@/lib/geocode";
import {
  playNotificationSoundRepeating,
  previewSound,
  getSavedSound,
  saveSound,
  SOUND_OPTIONS,
  type SoundType,
} from "@/lib/sounds";
import { useAuth } from "@/lib/auth-context";
import AgentBadge from "@/app/components/AgentBadge";
import AgentCard from "@/app/components/AgentCard";
import type { CoachPersonality } from "@/lib/coach-prompts";

const DEFAULT_DURATION = 25 * 60; // 25 minutes in seconds
const DEFAULT_BREAK_SECONDS = 5 * 60;

type SessionState = "idle" | "focusing" | "paused" | "break" | "abandoned" | "reset";

export default function FocusTab() {
  const { userId } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [focusDuration, setFocusDuration] = useState(DEFAULT_DURATION); // customizable
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION);
  const [distractions, setDistractions] = useState<string[]>([]);
  const [showDistractionModal, setShowDistractionModal] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  
  // Analytics state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const pauseCountRef = useRef(0);
  const sessionStartTimeRef = useRef<number | null>(null);

  // Sound settings
  const [notificationSound, setNotificationSound] = useState<SoundType>("bell");
  
  // Dropdown states
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showSoundDropdown, setShowSoundDropdown] = useState(false);
  const stopSoundPreviewRef = useRef<(() => void) | null>(null);

  // Break length (from prefs; used instead of hardcoded 5 min)
  const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK_SECONDS);
  // Agent session suggestions (before-session setup)
  const [sessionSuggestions, setSessionSuggestions] = useState<{
    suggestedDurationMinutes: number;
    suggestedBreakMinutes: number;
    reason: string | null;
    defaultFocusMinutes?: number;
    sessionCountUsed?: number;
  } | null>(null);
  const [coachSuggestionDismissed, setCoachSuggestionDismissed] = useState(false);
  const [showWhyReason, setShowWhyReason] = useState(false);
  const [sessionRules, setSessionRules] = useState<string[]>([]);
  const [coachPersonality, setCoachPersonality] = useState<CoachPersonality | null>(null);
  const [interventionDismissed, setInterventionDismissed] = useState(false);
  const interventionShownLoggedRef = useRef(false);
  const [resetCountdown, setResetCountdown] = useState(0);
  const [agentNotes, setAgentNotes] = useState<{ id: string; type: string; title: string; body: string; suggestion_text: string | null; created_at: string }[]>([]);

  // Load saved sound preference
  useEffect(() => {
    setNotificationSound(getSavedSound());
  }, []);

  // Load user preferences (focus, break, session rules, personality)
  useEffect(() => {
    if (!userId) return;
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.default_focus_minutes != null && typeof data.default_focus_minutes === "number") {
          const sec = Math.max(60, Math.min(120 * 60, data.default_focus_minutes * 60));
          setFocusDuration(sec);
          setTimeLeft(sec);
        }
        if (data.default_break_minutes != null && typeof data.default_break_minutes === "number") {
          setBreakDuration(Math.max(60, Math.min(30 * 60, data.default_break_minutes * 60)));
        }
        if (Array.isArray(data.session_rules)) {
          setSessionRules(data.session_rules);
        }
        if (data.coach_personality && ["strict", "data_focused", "encouraging"].includes(data.coach_personality)) {
          setCoachPersonality(data.coach_personality as CoachPersonality);
        }
      })
      .catch(() => {});
  }, [userId]);

  // Load agent session suggestions when idle; do not auto-apply (user chooses in Phase 2)
  useEffect(() => {
    if (!userId || sessionState !== "idle") return;
    fetch("/api/agent/session-suggestions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setSessionSuggestions(data);
        setCoachSuggestionDismissed(false); // show coach card again when we have fresh data
      })
      .catch(() => {});
  }, [userId, sessionState]);

  const handleSoundChange = (sound: SoundType) => {
    // Stop any current repeating preview
    if (stopSoundPreviewRef.current) {
      stopSoundPreviewRef.current();
      stopSoundPreviewRef.current = null;
    }
    setNotificationSound(sound);
    saveSound(sound);
    // Play new sound repeatedly for preview
    if (sound !== "none") {
      stopSoundPreviewRef.current = previewSound(sound);
    }
  };

  const closeSoundDropdown = () => {
    if (stopSoundPreviewRef.current) {
      stopSoundPreviewRef.current();
      stopSoundPreviewRef.current = null;
    }
    setShowSoundDropdown(false);
  };

  // Duration adjustment functions
  const adjustDuration = (deltaMinutes: number) => {
    const newDuration = Math.max(1 * 60, Math.min(120 * 60, focusDuration + deltaMinutes * 60));
    setFocusDuration(newDuration);
    setTimeLeft(newDuration);
  };

  const setPresetDuration = (minutes: number) => {
    const newDuration = minutes * 60;
    setFocusDuration(newDuration);
    setTimeLeft(newDuration);
    if (userId) {
      fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_focus_minutes: minutes }),
      }).catch(() => {});
    }
  };

  const setBreakMinutes = (minutes: number) => {
    const sec = Math.max(60, Math.min(30 * 60, minutes * 60));
    setBreakDuration(sec);
    if (userId) {
      fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_break_minutes: minutes }),
      }).catch(() => {});
    }
  };

  const toggleSessionRule = (rule: "phone_out_of_reach" | "single_task_only") => {
    const next = sessionRules.includes(rule)
      ? sessionRules.filter((r) => r !== rule)
      : [...sessionRules, rule];
    setSessionRules(next);
    if (userId) {
      fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_rules: next }),
      }).catch(() => {});
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress =
    sessionState === "break"
      ? ((breakDuration - timeLeft) / breakDuration) * 100
      : sessionState === "reset"
        ? ((2 * 60 - resetCountdown) / (2 * 60)) * 100
        : (focusDuration - timeLeft) / focusDuration * 100;

  const getTimeElapsed = () => {
    return focusDuration - timeLeft;
  };

  const handleStart = async () => {
    if (!userId) return;
    setSessionState("focusing");
    sessionStartTimeRef.current = Date.now();
    pauseCountRef.current = 0;

    const session = await createSession(focusDuration, userId);
    if (session) {
      setCurrentSessionId(session.id);
      captureLocationForSession(session.id);
    }
  };

  function captureLocationForSession(sessionId: string) {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const result = await reverseGeocode(lat, lon);
        await updateSession(sessionId, {
          latitude: lat,
          longitude: lon,
          location_label: result?.location_label ?? "Other",
        });
      },
      () => {},
      { timeout: 5000, maximumAge: 60000 }
    );
  }

  const handlePause = async () => {
    setSessionState("paused");
    pauseCountRef.current += 1;

    if (currentSessionId && userId) {
      await logSessionEvent(currentSessionId, "session_paused", {
        time_elapsed_seconds: getTimeElapsed(),
        time_remaining_seconds: timeLeft,
        distractions_count: distractions.length,
      }, userId);
    }
  };

  const handleResume = async () => {
    setSessionState("focusing");

    if (currentSessionId && userId) {
      await logSessionEvent(currentSessionId, "session_resumed", {
        time_elapsed_seconds: getTimeElapsed(),
        time_remaining_seconds: timeLeft,
      }, userId);
    }
  };

  const handleReset = () => {
    setSessionState("idle");
    setTimeLeft(focusDuration);
    setDistractions([]);
    setCurrentSessionId(null);
    setInterventionDismissed(false);
    interventionShownLoggedRef.current = false;
    setResetCountdown(0);
    pauseCountRef.current = 0;
    sessionStartTimeRef.current = null;
  };

  const handleLogDistraction = async (type: string) => {
    setDistractions([...distractions, type]);
    setShowDistractionModal(false);

    if (currentSessionId && userId) {
      await logDistraction(
        currentSessionId,
        type,
        getTimeElapsed(),
        timeLeft,
        userId
      );
    }
  };

  const handleOpenDistractionModal = async () => {
    setShowDistractionModal(true);

    if (currentSessionId && userId) {
      await logSessionEvent(currentSessionId, "distraction_modal_opened", {
        time_elapsed_seconds: getTimeElapsed(),
      }, userId);
    }
  };

  const handleCloseDistractionModal = async () => {
    setShowDistractionModal(false);

    if (currentSessionId && userId) {
      await logSessionEvent(currentSessionId, "distraction_modal_closed", {
        time_elapsed_seconds: getTimeElapsed(),
      }, userId);
    }
  };

  const handleOpenAbandonModal = async () => {
    setShowAbandonConfirm(true);

    if (currentSessionId && userId) {
      await logSessionEvent(currentSessionId, "abandon_modal_opened", {
        time_elapsed_seconds: getTimeElapsed(),
        distractions_count: distractions.length,
      }, userId);
    }
  };

  const handleCloseAbandonModal = async () => {
    setShowAbandonConfirm(false);

    if (currentSessionId && userId) {
      await logSessionEvent(currentSessionId, "abandon_modal_dismissed", {
        time_elapsed_seconds: getTimeElapsed(),
      }, userId);
    }
  };

  const handleAbandon = async () => {
    const actualDuration = getTimeElapsed();
    setSessionState("abandoned");
    setShowAbandonConfirm(false);

    if (currentSessionId && userId) {
      await updateSession(currentSessionId, {
        status: "abandoned",
        ended_at: new Date().toISOString(),
        actual_duration_seconds: actualDuration,
        total_distractions: distractions.length,
        total_pauses: pauseCountRef.current,
      });

      await logSessionEvent(currentSessionId, "session_abandoned", {
        actual_duration_seconds: actualDuration,
        planned_duration_seconds: focusDuration,
        completion_percentage: (actualDuration / focusDuration) * 100,
        distractions_count: distractions.length,
        total_pauses: pauseCountRef.current,
      }, userId);
    }
  };

  const startBreak = useCallback(async () => {
    // Play notification sound repeatedly when focus session completes
    playNotificationSoundRepeating(notificationSound);

    setSessionState("break");
    setTimeLeft(breakDuration);
    
    if (currentSessionId && userId) {
      await updateSession(currentSessionId, {
        status: "completed",
        ended_at: new Date().toISOString(),
        actual_duration_seconds: focusDuration,
        total_distractions: distractions.length,
        total_pauses: pauseCountRef.current,
      });

      await logSessionEvent(currentSessionId, "session_completed", {
        actual_duration_seconds: focusDuration,
        distractions_count: distractions.length,
        total_pauses: pauseCountRef.current,
      }, userId);

      await logSessionEvent(currentSessionId, "break_started", {}, userId);
    }
  }, [currentSessionId, userId, distractions.length, focusDuration, breakDuration, notificationSound]);

  // Timer effect (focus and break countdown)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (sessionState === "focusing" || sessionState === "break") {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (sessionState === "focusing") {
              startBreak();
            } else {
              playNotificationSoundRepeating(notificationSound);
              if (currentSessionId && userId) {
                logSessionEvent(currentSessionId, "break_completed", {}, userId);
              }
              setSessionState("idle");
              setTimeLeft(focusDuration);
              return focusDuration;
            }
            return prev;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [sessionState, startBreak, currentSessionId, userId, focusDuration, notificationSound]);

  // Reset countdown (2-minute reset during session)
  useEffect(() => {
    if (sessionState !== "reset" || resetCountdown <= 0) return;
    const interval = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev <= 1) {
          setSessionState("focusing");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionState, resetCountdown]);

  useEffect(() => {
    if (sessionState !== "focusing" || !currentSessionId || !userId) return;

    const handleVisibilityChange = () => {
      const timeElapsed = focusDuration - timeLeft;
      if (document.hidden) {
        logSessionEvent(currentSessionId, "page_blurred", {
          time_elapsed_seconds: timeElapsed,
        }, userId);
      } else {
        logSessionEvent(currentSessionId, "page_focused", {
          time_elapsed_seconds: timeElapsed,
        }, userId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionState, currentSessionId, userId, timeLeft, focusDuration]);

  useEffect(() => {
    if (userId) logSessionEvent(null, "timer_viewed", {}, userId);
  }, [userId]);

  // Load agent notes when idle; refresh may create new notes from distraction patterns
  useEffect(() => {
    if (!userId || sessionState !== "idle") return;
    const load = () => {
      fetch("/api/agent/notes/refresh", { method: "POST" })
        .then(() => fetch("/api/agent/notes"))
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setAgentNotes(Array.isArray(data) ? data : []))
        .catch(() => {});
    };
    load();
  }, [userId, sessionState]);

  // Log once when intervention card is shown (so it appears in History with why)
  useEffect(() => {
    if (
      !userId ||
      (sessionState !== "focusing" && sessionState !== "paused") ||
      distractions.length < 3 ||
      interventionDismissed ||
      interventionShownLoggedRef.current
    )
      return;
    interventionShownLoggedRef.current = true;
    fetch("/api/agent/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type: "agent_intervention_shown",
        description: "Focus Agent offered to shorten session or take a 2-minute reset",
        payload: {
          why: `You had ${distractions.length} distractions in this session; the agent suggested shortening the session or taking a short reset to refocus.`,
        },
      }),
    }).catch(() => {});
  }, [userId, sessionState, distractions.length, interventionDismissed]);

  const dismissNote = (id: string) => {
    fetch(`/api/agent/notes/${id}/dismiss`, { method: "POST" }).then(() => {
      setAgentNotes((prev) => prev.filter((n) => n.id !== id));
    }).catch(() => {});
  };

  const applyCoachSuggestion = () => {
    if (!sessionSuggestions) return;
    const durSec = Math.max(60, Math.min(120 * 60, sessionSuggestions.suggestedDurationMinutes * 60));
    const breakSec = Math.max(60, Math.min(30 * 60, (sessionSuggestions.suggestedBreakMinutes ?? 5) * 60));
    setFocusDuration(durSec);
    setTimeLeft(durSec);
    setBreakDuration(breakSec);
    setCoachSuggestionDismissed(true);
    fetch("/api/agent/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type: "session_adjusted",
        description: "User accepted coach suggestion",
        payload: {
          suggestedDurationMinutes: sessionSuggestions.suggestedDurationMinutes,
          reason: sessionSuggestions.reason,
        },
      }),
    }).catch(() => {});
  };

  const stickToDefault = () => {
    if (!sessionSuggestions) return;
    const defaultMin = sessionSuggestions.defaultFocusMinutes ?? 25;
    const durSec = Math.max(60, Math.min(120 * 60, defaultMin * 60));
    setFocusDuration(durSec);
    setTimeLeft(durSec);
    setCoachSuggestionDismissed(true);
  };

  return (
    <>
      <div className="min-h-[calc(100vh-120px)] md:min-h-screen flex flex-col justify-center max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {sessionState === "idle" && "Ready to focus?"}
            {sessionState === "focusing" && "Deep work in progress"}
            {sessionState === "paused" && "Session paused"}
            {sessionState === "reset" && "Short reset"}
            {sessionState === "break" && "Take a break ☕"}
            {sessionState === "abandoned" && "Session ended"}
          </h1>
          <p className="mt-2 text-muted">
            {sessionState === "idle" && `Start a ${Math.floor(focusDuration / 60)}-minute focus session`}
            {sessionState === "focusing" && "Stay focused, you got this!"}
            {sessionState === "paused" && "Resume when you're ready"}
            {sessionState === "reset" && `${Math.floor(resetCountdown / 60)}:${(resetCountdown % 60).toString().padStart(2, "0")} left in reset`}
            {sessionState === "break" && "You've earned it! Stretch, breathe."}
            {sessionState === "abandoned" && "It's okay. Every session teaches us something."}
          </p>
        </div>

        {/* Agent Notes / Inbox (idle only) */}
        {sessionState === "idle" && agentNotes.length > 0 && (
          <div className="mb-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Agent Notes</h2>
            {agentNotes.map((note) => (
              <AgentCard key={note.id} personality={coachPersonality}>
                <h3 className="font-semibold text-foreground mb-1">{note.title}</h3>
                <p className="text-sm text-muted mb-2">{note.body}</p>
                {note.suggestion_text && (
                  <p className="text-sm text-foreground mb-4">Suggested change: {note.suggestion_text}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => dismissNote(note.id)}
                    className="btn-secondary text-sm py-2 px-4"
                  >
                    Try tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissNote(note.id)}
                    className="text-sm text-muted hover:text-foreground py-2 px-4"
                  >
                    Dismiss
                  </button>
                </div>
              </AgentCard>
            ))}
          </div>
        )}

        {/* Agent: coach suggestion + Today's focus setup (idle only, one box) */}
        {sessionState === "idle" && (
          <AgentCard personality={coachPersonality} className="mb-6">
            {sessionSuggestions &&
              sessionSuggestions.sessionCountUsed != null &&
              sessionSuggestions.sessionCountUsed >= 3 &&
              sessionSuggestions.defaultFocusMinutes != null &&
              sessionSuggestions.suggestedDurationMinutes !== sessionSuggestions.defaultFocusMinutes &&
              !coachSuggestionDismissed && (
              <>
                <h3 className="font-semibold text-foreground mb-2">Coach suggestion</h3>
                <p className="text-sm text-muted mb-4">
                  Based on your last {sessionSuggestions.sessionCountUsed} sessions,{" "}
                  <strong className="text-foreground">{sessionSuggestions.suggestedDurationMinutes} minutes</strong>{" "}
                  works better for you lately.
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  <button
                    type="button"
                    onClick={applyCoachSuggestion}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    Use suggestion
                  </button>
                  <button
                    type="button"
                    onClick={stickToDefault}
                    className="btn-secondary text-sm py-2 px-4"
                  >
                    Stick to my default ({sessionSuggestions.defaultFocusMinutes} min)
                  </button>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mb-4" />
              </>
            )}
            <h3 className="font-semibold text-foreground mb-3">Today&apos;s focus setup</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                {Math.floor(focusDuration / 60)} min
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm">
                <Zap className="w-4 h-4 text-primary" />
                {Math.floor(breakDuration / 60)} min break
              </span>
              {sessionRules.includes("phone_out_of_reach") && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm">
                  <PhoneOff className="w-4 h-4 text-primary" />
                  Phone out of reach
                </span>
              )}
              {sessionRules.includes("single_task_only") && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm">
                  <Target className="w-4 h-4 text-primary" />
                  Single task only
                </span>
              )}
            </div>
            <p className="text-sm text-muted flex items-center gap-2 flex-wrap">
              <AgentBadge personality={coachPersonality} />
              <span>Designed by your Focus Agent</span>
            </p>
            {coachSuggestionDismissed && sessionSuggestions?.reason != null && sessionSuggestions.reason !== "" && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowWhyReason((v) => !v)}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Why this duration? {showWhyReason ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showWhyReason && (
                  <p className="mt-2 text-sm text-muted">{sessionSuggestions.reason}</p>
                )}
              </div>
            )}
            {/* Editable chips: duration and break open dropdowns; rules are toggles */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowDurationDropdown(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 text-sm hover:border-primary/40"
              >
                <Clock className="w-4 h-4" /> {Math.floor(focusDuration / 60)} min
              </button>
              <select
                aria-label="Break length in minutes"
                value={Math.floor(breakDuration / 60)}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 text-sm hover:border-primary/40 bg-transparent"
              >
                {[2, 5, 10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>{m} min break</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toggleSessionRule("phone_out_of_reach")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-sm ${
                  sessionRules.includes("phone_out_of_reach")
                    ? "border-primary bg-primary/10"
                    : "border-dashed border-gray-200 dark:border-gray-600 hover:border-primary/40"
                }`}
              >
                <PhoneOff className="w-4 h-4" /> Phone out of reach
              </button>
              <button
                type="button"
                onClick={() => toggleSessionRule("single_task_only")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-sm ${
                  sessionRules.includes("single_task_only")
                    ? "border-primary bg-primary/10"
                    : "border-dashed border-gray-200 dark:border-gray-600 hover:border-primary/40"
                }`}
              >
                <Target className="w-4 h-4" /> Single task only
              </button>
            </div>
          </AgentCard>
        )}

        {/* Timer Card - overflow-visible so dropdowns aren't clipped */}
        <div className="card !p-8 sm:!p-12 text-center relative overflow-visible">
          {/* Animated background pulse when focusing - overflow-hidden keeps pulse inside card */}
          {sessionState === "focusing" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-[inherit]">
              <div className="w-64 h-64 rounded-full bg-primary/5 animate-pulse-slow" />
              <div className="absolute w-48 h-48 rounded-full bg-primary/10 animate-pulse-slower" />
            </div>
          )}

          {/* Progress Ring */}
          <div className="relative inline-flex items-center justify-center mb-8">
            <svg className="w-48 h-48 sm:w-56 sm:h-56 -rotate-90" viewBox="0 0 200 200">
              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                className="stroke-gray-200 dark:stroke-gray-700"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke={sessionState === "break" ? "#10B981" : "#7C6AFF"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 90}
                strokeDashoffset={2 * Math.PI * 90 * (1 - progress / 100)}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            {/* Timer Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl sm:text-5xl font-bold tracking-tight ${
                sessionState === "focusing" ? "animate-number-pulse" : ""
              }`}>
                {sessionState === "reset"
                  ? formatTime(resetCountdown)
                  : formatTime(timeLeft)}
              </span>
              {sessionState !== "idle" && sessionState !== "abandoned" && (
                <span className="text-sm text-muted mt-2">
                  {sessionState === "break" ? "break time" : sessionState === "reset" ? "reset" : "remaining"}
                </span>
              )}
            </div>
          </div>

          {/* Settings Row - Duration & Sound (only shown when idle) */}
          {sessionState === "idle" && (
            <div className="mb-6 flex items-center justify-center gap-2">
              {/* Duration: minus button */}
              <button
                onClick={() => adjustDuration(-5)}
                className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-soft hover:shadow-card flex items-center justify-center transition-all disabled:opacity-50"
                disabled={focusDuration <= 60}
                aria-label="Decrease duration by 5 minutes"
              >
                <Minus className="w-3 h-3 text-muted" />
              </button>

              {/* Duration dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowDurationDropdown(!showDurationDropdown);
                    setShowSoundDropdown(false);
                  }}
                  className="flex items-center gap-2 bg-white dark:bg-gray-800 shadow-soft hover:shadow-card rounded-full px-4 py-2 text-sm font-medium text-foreground transition-all"
                >
                  <span>{Math.floor(focusDuration / 60)} min</span>
                  <svg className={`w-4 h-4 text-muted transition-transform ${showDurationDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showDurationDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDurationDropdown(false)} />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-float p-2 z-20 min-w-[120px]">
                      <div className="grid grid-cols-2 gap-1">
                        {[1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((min) => (
                          <button
                            key={min}
                            onClick={() => {
                              setPresetDuration(min);
                              setShowDurationDropdown(false);
                            }}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                              focusDuration === min * 60
                                ? "bg-primary text-white"
                                : "hover:bg-primary-light dark:hover:bg-primary/20 text-foreground"
                            }`}
                          >
                            {min}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Duration: plus button */}
              <button
                onClick={() => adjustDuration(5)}
                className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-soft hover:shadow-card flex items-center justify-center transition-all disabled:opacity-50"
                disabled={focusDuration >= 120 * 60}
                aria-label="Increase duration by 5 minutes"
              >
                <Plus className="w-3 h-3 text-muted" />
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />

              {/* Sound dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSoundDropdown(!showSoundDropdown);
                    setShowDurationDropdown(false);
                  }}
                  className="flex items-center gap-2 bg-white dark:bg-gray-800 shadow-soft hover:shadow-card rounded-full px-3 py-2 text-sm font-medium text-foreground transition-all"
                >
                  <Volume2 className="w-4 h-4 text-primary" />
                  <span>{SOUND_OPTIONS.find(s => s.value === notificationSound)?.label}</span>
                  <svg className={`w-4 h-4 text-muted transition-transform ${showSoundDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showSoundDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={closeSoundDropdown} />
                    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-float p-2 z-20 min-w-[140px]">
                      {SOUND_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            handleSoundChange(option.value);
                            setShowSoundDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${
                            notificationSound === option.value
                              ? "bg-primary text-white"
                              : "hover:bg-primary-light dark:hover:bg-primary/20 text-foreground"
                          }`}
                        >
                          {option.value === "none" ? (
                            <span className="w-4 h-4 flex items-center justify-center text-xs">🔇</span>
                          ) : (
                            <span className="w-4 h-4 flex items-center justify-center text-xs">🔔</span>
                          )}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {sessionState === "idle" && (
              <button
                onClick={handleStart}
                disabled={!userId}
                className="btn-primary text-lg px-8 py-4 animate-bounce-subtle disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5 fill-white" />
                Start Focus
              </button>
            )}

            {sessionState === "focusing" && (
              <button
                onClick={handlePause}
                className="btn-secondary px-6 py-3"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            )}

            {sessionState === "paused" && (
              <>
                <button
                  onClick={handleResume}
                  className="btn-primary px-6 py-3"
                >
                  <Play className="w-5 h-5 fill-white" />
                  Resume
                </button>
                <button
                  onClick={handleReset}
                  className="btn-secondary px-6 py-3"
                >
                  <RotateCcw className="w-5 h-5" />
                  Reset
                </button>
              </>
            )}

            {sessionState === "break" && (
              <button
                onClick={handleReset}
                className="btn-primary px-6 py-3"
              >
                <Zap className="w-5 h-5" />
                Start New Session
              </button>
            )}

            {sessionState === "abandoned" && (
              <button
                onClick={handleReset}
                className="btn-primary px-6 py-3"
              >
                <RotateCcw className="w-5 h-5" />
                Try Again
              </button>
            )}
          </div>

          {/* Distraction counter */}
          {distractions.length > 0 && sessionState !== "abandoned" && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-muted">
                Distractions logged: <span className="font-semibold text-foreground">{distractions.length}</span>
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {(sessionState === "focusing" || sessionState === "paused") && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              onClick={handleOpenDistractionModal}
              className="card !p-4 flex items-center justify-center gap-3 hover:border-amber-300 dark:hover:border-amber-600 border-2 border-transparent transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Log Distraction</p>
                <p className="text-xs text-muted">Track what pulled you away</p>
              </div>
            </button>

            <button
              onClick={handleOpenAbandonModal}
              className="card !p-4 flex items-center justify-center gap-3 hover:border-red-300 dark:hover:border-red-600 border-2 border-transparent transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Abandon Session</p>
                <p className="text-xs text-muted">End without completing</p>
              </div>
            </button>
          </div>
        )}

        {/* Session Summary (when abandoned) */}
        {sessionState === "abandoned" && (
          <div className="mt-6 card !p-6">
            <h3 className="font-semibold mb-4">Session Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-muted">Time focused</p>
                <p className="text-xl font-bold">{formatTime(focusDuration - timeLeft)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-muted">Distractions</p>
                <p className="text-xl font-bold">{distractions.length}</p>
              </div>
            </div>
            {distractions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-muted mb-2">What distracted you:</p>
                <div className="flex flex-wrap gap-2">
                  {distractions.map((d, i) => (
                    <span key={i} className="badge">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mascot Encouragement */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 bg-primary-light dark:bg-primary/20 rounded-full px-5 py-3">
            <span className="text-2xl">
              {sessionState === "idle" && "🧠"}
              {sessionState === "focusing" && "💪"}
              {sessionState === "paused" && "⏸️"}
              {sessionState === "reset" && "🔄"}
              {sessionState === "break" && "☕"}
              {sessionState === "abandoned" && "🤗"}
            </span>
            <span className="text-sm text-primary font-medium">
              {sessionState === "idle" && "Your brain is ready to do great work!"}
              {sessionState === "focusing" && "Deep focus mode activated!"}
              {sessionState === "paused" && "Take your time, I'll wait."}
              {sessionState === "reset" && "Back to focus in a moment."}
              {sessionState === "break" && "Rest is part of the process!"}
              {sessionState === "abandoned" && "Tomorrow is another chance!"}
            </span>
          </div>
        </div>
      </div>

      {/* Distraction Modal */}
      {showDistractionModal && (
        <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-float animate-modal-enter">
            <h3 className="text-xl font-bold mb-2">What distracted you?</h3>
            <p className="text-muted text-sm mb-6">Tracking helps identify patterns</p>
            
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Social Media", icon: "📱" },
                { label: "Email/Slack", icon: "📧" },
                { label: "Coworker", icon: "👋" },
                { label: "Phone Call", icon: "📞" },
                { label: "Hunger/Thirst", icon: "🍕" },
                { label: "Random Thought", icon: "💭" },
                { label: "News/Articles", icon: "📰" },
                { label: "Other", icon: "❓" }
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleLogDistraction(item.label)}
                  className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 hover:bg-primary-light dark:hover:bg-primary/20 rounded-2xl transition-colors text-left"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleCloseDistractionModal}
              className="mt-6 w-full btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Abandon Confirmation Modal */}
      {showAbandonConfirm && (
        <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-float animate-modal-enter">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Abandon session?</h3>
              <p className="text-muted text-sm mb-6">
                It's okay to stop when you need to. Your progress will be saved for insights.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCloseAbandonModal}
                className="flex-1 btn-secondary"
              >
                Keep Going
              </button>
              <button
                onClick={handleAbandon}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-full px-5 py-2.5 transition-colors"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Focus Agent intervention (slide-in from bottom when 3+ distractions) */}
      {(sessionState === "focusing" || sessionState === "paused") &&
        distractions.length >= 3 &&
        !interventionDismissed && (
          <div className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 animate-in slide-in-from-bottom duration-300">
            <AgentCard personality={coachPersonality} className="max-w-sm mx-auto shadow-float w-full">
              <h3 className="font-semibold text-foreground text-sm sm:text-base mb-0.5">Focus Agent detected a pattern</h3>
              <p className="text-xs sm:text-sm text-muted mb-3">
                You&apos;ve logged {distractions.length} distractions in this session.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFocusDuration(15 * 60);
                      setTimeLeft(15 * 60);
                      setInterventionDismissed(true);
                      if (currentSessionId && userId) {
                        logSessionEvent(currentSessionId, "agent_intervention_shorten", { new_duration_minutes: 15 }, userId);
                        fetch("/api/agent/activity-log", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action_type: "session_shortened",
                            description: "Shortened session to 15 min",
                            payload: {
                              new_duration_minutes: 15,
                              why: "You had 3+ distractions in this session; shortening to 15 min helps you finish strong.",
                            },
                          }),
                        }).catch(() => {});
                      }
                    }}
                    className="btn-primary flex-1 min-w-0 text-xs sm:text-sm py-2 px-3 whitespace-nowrap rounded-full"
                  >
                    Shorten to 15 min
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionState("reset");
                      setResetCountdown(2 * 60);
                      setInterventionDismissed(true);
                      if (currentSessionId && userId) {
                        logSessionEvent(currentSessionId, "agent_intervention_reset", {}, userId);
                        fetch("/api/agent/activity-log", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action_type: "agent_intervention_reset",
                            description: "Took a 2-minute reset during session",
                            payload: {
                              why: "You had 3+ distractions in this session; a short reset can help you refocus.",
                            },
                          }),
                        }).catch(() => {});
                      }
                    }}
                    className="btn-secondary flex-1 min-w-0 text-xs sm:text-sm py-2 px-3 whitespace-nowrap rounded-full"
                  >
                    2-min reset
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInterventionDismissed(true);
                    if (currentSessionId && userId) {
                      logSessionEvent(currentSessionId, "agent_intervention_ignore", {}, userId);
                    }
                  }}
                  className="text-xs sm:text-sm text-muted hover:text-foreground py-1.5 sm:shrink-0 self-start sm:self-center"
                >
                  Ignore
                </button>
              </div>
            </AgentCard>
          </div>
        )}
    </>
  );
}
