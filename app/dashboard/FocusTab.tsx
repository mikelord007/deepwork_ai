"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
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
import {
  playNotificationSoundRepeating,
  previewSound,
  getSavedSound,
  saveSound,
  SOUND_OPTIONS,
  type SoundType,
} from "@/lib/sounds";
import { useAuth } from "@/lib/auth-context";

const DEFAULT_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes in seconds

type SessionState = "idle" | "focusing" | "paused" | "break" | "abandoned";

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

  // Load saved sound preference
  useEffect(() => {
    setNotificationSound(getSavedSound());
  }, []);

  // Load default session length from user preferences (once)
  useEffect(() => {
    if (!userId) return;
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.default_focus_minutes && typeof data.default_focus_minutes === "number") {
          const sec = data.default_focus_minutes * 60;
          setFocusDuration(sec);
          setTimeLeft(sec);
        }
      })
      .catch(() => {});
  }, [userId]);

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
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = sessionState === "break" 
    ? ((BREAK_DURATION - timeLeft) / BREAK_DURATION) * 100
    : ((focusDuration - timeLeft) / focusDuration) * 100;

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
    }
  };

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
    setTimeLeft(BREAK_DURATION);
    
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
  }, [currentSessionId, userId, distractions.length, focusDuration, notificationSound]);

  // Timer effect
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

  return (
    <>
      <div className="min-h-[calc(100vh-120px)] md:min-h-screen flex flex-col justify-center max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {sessionState === "idle" && "Ready to focus?"}
            {sessionState === "focusing" && "Deep work in progress"}
            {sessionState === "paused" && "Session paused"}
            {sessionState === "break" && "Take a break ☕"}
            {sessionState === "abandoned" && "Session ended"}
          </h1>
          <p className="mt-2 text-muted">
            {sessionState === "idle" && `Start a ${Math.floor(focusDuration / 60)}-minute focus session`}
            {sessionState === "focusing" && "Stay focused, you got this!"}
            {sessionState === "paused" && "Resume when you're ready"}
            {sessionState === "break" && "You've earned it! Stretch, breathe."}
            {sessionState === "abandoned" && "It's okay. Every session teaches us something."}
          </p>
        </div>

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
                {formatTime(timeLeft)}
              </span>
              {sessionState !== "idle" && sessionState !== "abandoned" && (
                <span className="text-sm text-muted mt-2">
                  {sessionState === "break" ? "break time" : "remaining"}
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
              {sessionState === "break" && "☕"}
              {sessionState === "abandoned" && "🤗"}
            </span>
            <span className="text-sm text-primary font-medium">
              {sessionState === "idle" && "Your brain is ready to do great work!"}
              {sessionState === "focusing" && "Deep focus mode activated!"}
              {sessionState === "paused" && "Take your time, I'll wait."}
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
    </>
  );
}
