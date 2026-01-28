"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle,
  BarChart3,
  Home,
  Pause,
  Play,
  RotateCcw,
  X,
  Zap
} from "lucide-react";
import {
  createSession,
  updateSession,
  logSessionEvent,
  logDistraction,
} from "@/lib/analytics";

const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes in seconds

type SessionState = "idle" | "focusing" | "paused" | "break" | "abandoned";

export default function DashboardPage() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [timeLeft, setTimeLeft] = useState(POMODORO_DURATION);
  const [distractions, setDistractions] = useState<string[]>([]);
  const [showDistractionModal, setShowDistractionModal] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  
  // Analytics state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const pauseCountRef = useRef(0);
  const sessionStartTimeRef = useRef<number | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = sessionState === "break" 
    ? ((BREAK_DURATION - timeLeft) / BREAK_DURATION) * 100
    : ((POMODORO_DURATION - timeLeft) / POMODORO_DURATION) * 100;

  const getTimeElapsed = () => {
    return POMODORO_DURATION - timeLeft;
  };

  const handleStart = async () => {
    setSessionState("focusing");
    sessionStartTimeRef.current = Date.now();
    pauseCountRef.current = 0;
    
    // Create session in Supabase
    const session = await createSession(POMODORO_DURATION);
    if (session) {
      setCurrentSessionId(session.id);
    }
  };

  const handlePause = async () => {
    setSessionState("paused");
    pauseCountRef.current += 1;
    
    // Log pause event
    if (currentSessionId) {
      await logSessionEvent(currentSessionId, "session_paused", {
        time_elapsed_seconds: getTimeElapsed(),
        time_remaining_seconds: timeLeft,
        distractions_count: distractions.length,
      });
    }
  };

  const handleResume = async () => {
    setSessionState("focusing");
    
    // Log resume event
    if (currentSessionId) {
      await logSessionEvent(currentSessionId, "session_resumed", {
        time_elapsed_seconds: getTimeElapsed(),
        time_remaining_seconds: timeLeft,
      });
    }
  };

  const handleReset = () => {
    setSessionState("idle");
    setTimeLeft(POMODORO_DURATION);
    setDistractions([]);
    setCurrentSessionId(null);
    pauseCountRef.current = 0;
    sessionStartTimeRef.current = null;
  };

  const handleLogDistraction = async (type: string) => {
    setDistractions([...distractions, type]);
    setShowDistractionModal(false);
    
    // Log distraction with timing data
    if (currentSessionId) {
      await logDistraction(
        currentSessionId,
        type,
        getTimeElapsed(),
        timeLeft
      );
    }
  };

  const handleOpenDistractionModal = async () => {
    setShowDistractionModal(true);
    
    // Log modal open event
    if (currentSessionId) {
      await logSessionEvent(currentSessionId, "distraction_modal_opened", {
        time_elapsed_seconds: getTimeElapsed(),
      });
    }
  };

  const handleCloseDistractionModal = async () => {
    setShowDistractionModal(false);
    
    // Log modal close without logging distraction
    if (currentSessionId) {
      await logSessionEvent(currentSessionId, "distraction_modal_closed", {
        time_elapsed_seconds: getTimeElapsed(),
      });
    }
  };

  const handleOpenAbandonModal = async () => {
    setShowAbandonConfirm(true);
    
    // Log abandon modal open
    if (currentSessionId) {
      await logSessionEvent(currentSessionId, "abandon_modal_opened", {
        time_elapsed_seconds: getTimeElapsed(),
        distractions_count: distractions.length,
      });
    }
  };

  const handleCloseAbandonModal = async () => {
    setShowAbandonConfirm(false);
    
    // Log that user decided to keep going
    if (currentSessionId) {
      await logSessionEvent(currentSessionId, "abandon_modal_dismissed", {
        time_elapsed_seconds: getTimeElapsed(),
      });
    }
  };

  const handleAbandon = async () => {
    const actualDuration = getTimeElapsed();
    setSessionState("abandoned");
    setShowAbandonConfirm(false);
    
    // Update session in Supabase
    if (currentSessionId) {
      await updateSession(currentSessionId, {
        status: "abandoned",
        ended_at: new Date().toISOString(),
        actual_duration_seconds: actualDuration,
        total_distractions: distractions.length,
        total_pauses: pauseCountRef.current,
      });
      
      await logSessionEvent(currentSessionId, "session_abandoned", {
        actual_duration_seconds: actualDuration,
        planned_duration_seconds: POMODORO_DURATION,
        completion_percentage: (actualDuration / POMODORO_DURATION) * 100,
        distractions_count: distractions.length,
        total_pauses: pauseCountRef.current,
      });
    }
  };

  const startBreak = useCallback(async () => {
    setSessionState("break");
    setTimeLeft(BREAK_DURATION);
    
    // Mark session as completed
    if (currentSessionId) {
      await updateSession(currentSessionId, {
        status: "completed",
        ended_at: new Date().toISOString(),
        actual_duration_seconds: POMODORO_DURATION,
        total_distractions: distractions.length,
        total_pauses: pauseCountRef.current,
      });
      
      await logSessionEvent(currentSessionId, "session_completed", {
        actual_duration_seconds: POMODORO_DURATION,
        distractions_count: distractions.length,
        total_pauses: pauseCountRef.current,
      });
      
      await logSessionEvent(currentSessionId, "break_started", {});
    }
  }, [currentSessionId, distractions.length]);

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
              // Break completed
              if (currentSessionId) {
                logSessionEvent(currentSessionId, "break_completed", {});
              }
              setSessionState("idle");
              return POMODORO_DURATION;
            }
            return prev;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [sessionState, startBreak, currentSessionId]);

  // Track page visibility (user switching tabs during focus)
  useEffect(() => {
    if (sessionState !== "focusing" || !currentSessionId) return;

    const handleVisibilityChange = () => {
      const timeElapsed = POMODORO_DURATION - timeLeft;
      if (document.hidden) {
        logSessionEvent(currentSessionId, "page_blurred", {
          time_elapsed_seconds: timeElapsed,
        });
      } else {
        logSessionEvent(currentSessionId, "page_focused", {
          time_elapsed_seconds: timeElapsed,
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionState, currentSessionId, timeLeft]);

  // Log when user views the timer page
  useEffect(() => {
    logSessionEvent(null, "timer_viewed", {});
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-soft">
                <span className="text-white text-sm font-bold">dw</span>
              </div>
              <span className="font-heading font-semibold text-foreground">deepwork.ai</span>
            </div>

            <div className="flex items-center gap-4">
              <a href="/metrics" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Metrics</span>
              </a>
              <a href="/" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
                <Home className="w-4 h-4" />
                <span className="text-sm">Home</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20">
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
            {sessionState === "idle" && "Start a 25-minute focus session"}
            {sessionState === "focusing" && "Stay focused, you got this!"}
            {sessionState === "paused" && "Resume when you're ready"}
            {sessionState === "break" && "You've earned it! Stretch, breathe."}
            {sessionState === "abandoned" && "It's okay. Every session teaches us something."}
          </p>
        </div>

        {/* Timer Card */}
        <div className="card !p-8 sm:!p-12 text-center relative overflow-hidden">
          {/* Animated background pulse when focusing */}
          {sessionState === "focusing" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
                stroke="#E5E7EB"
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

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {sessionState === "idle" && (
              <button
                onClick={handleStart}
                className="btn-primary text-lg px-8 py-4 animate-bounce-subtle"
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
            <div className="mt-6 pt-6 border-t border-gray-100">
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
              className="card !p-4 flex items-center justify-center gap-3 hover:border-amber-300 border-2 border-transparent transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Log Distraction</p>
                <p className="text-xs text-muted">Track what pulled you away</p>
              </div>
            </button>

            <button
              onClick={handleOpenAbandonModal}
              className="card !p-4 flex items-center justify-center gap-3 hover:border-red-300 border-2 border-transparent transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <X className="w-5 h-5 text-red-600" />
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
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs text-muted">Time focused</p>
                <p className="text-xl font-bold">{formatTime(POMODORO_DURATION - timeLeft)}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs text-muted">Distractions</p>
                <p className="text-xl font-bold">{distractions.length}</p>
              </div>
            </div>
            {distractions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
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
          <div className="inline-flex items-center gap-3 bg-primary-light rounded-full px-5 py-3">
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-float animate-modal-enter">
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
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-primary-light rounded-2xl transition-colors text-left"
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-float animate-modal-enter">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-500" />
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
    </main>
  );
}
