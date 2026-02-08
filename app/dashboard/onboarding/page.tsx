"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STEPS = [
  { id: 1, title: "When you fall off track, what helps more?" },
  { id: 2, title: "What are you trying to focus on?" },
  { id: 3, title: "What usually breaks your focus?" },
  { id: 4, title: "How long can you realistically focus?" },
  { id: 5, title: "What time of day do you want to focus?" },
  { id: 6, title: "If this app works perfectly, what would change for you?" },
] as const;

const COACH_OPTIONS: { value: "strict" | "data_focused" | "encouraging"; label: string }[] = [
  { value: "strict", label: "Call me out. Don't sugarcoat." },
  { value: "data_focused", label: "Show me the data." },
  { value: "encouraging", label: "Encourage me and help me reset." },
];

const FOCUS_DOMAIN_OPTIONS: { value: string; label: string }[] = [
  { value: "deep_work", label: "Deep work / coding" },
  { value: "studying", label: "Studying / exams" },
  { value: "creative", label: "Creative work (writing, design, music)" },
  { value: "job_search", label: "Job search / interviews" },
  { value: "admin", label: "Admin / life tasks" },
  { value: "habit", label: "Building a habit" },
  { value: "other", label: "Something else" },
];

const DISTRACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "phone_social", label: "Phone / social media" },
  { value: "notifications", label: "Notifications" },
  { value: "overthinking", label: "Overthinking / anxiety" },
  { value: "boredom", label: "Boredom" },
  { value: "fatigue", label: "Fatigue / low energy" },
  { value: "stuck", label: "Getting stuck / not knowing next step" },
  { value: "external", label: "External interruptions (people, noise)" },
  { value: "tab_switching", label: "Switching tabs too much" },
];

const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "10–15 min" },
  { value: 25, label: "20–30 min" },
  { value: 45, label: "45–60 min" },
  { value: 90, label: "90+ min" },
];

const TIME_OF_DAY_OPTIONS: { value: string; label: string }[] = [
  { value: "early_morning", label: "Early morning" },
  { value: "late_morning", label: "Late morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
  { value: "no_fixed", label: "No fixed time" },
];

const SUCCESS_GOAL_OPTIONS: { value: string; label: string }[] = [
  { value: "procrastinate_less", label: "I'd procrastinate less" },
  { value: "finish_what_start", label: "I'd finish what I start" },
  { value: "less_guilty", label: "I'd feel less guilty about work" },
  { value: "more_consistent", label: "I'd be more consistent" },
  { value: "more_done", label: "I'd get more done in less time" },
  { value: "feel_calmer", label: "I'd feel calmer while working" },
];

const MAX_DISTRACTIONS = 3;

type FormState = {
  coach_personality: "strict" | "data_focused" | "encouraging";
  focus_domains: string[];
  distraction_triggers: string[];
  default_focus_minutes: number;
  preferred_focus_time: string;
  success_goals: string[];
  custom_focus_domain: string;
};

const initialForm: FormState = {
  coach_personality: "data_focused",
  focus_domains: [],
  distraction_triggers: [],
  default_focus_minutes: 25,
  preferred_focus_time: "no_fixed",
  success_goals: [],
  custom_focus_domain: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleArray = useCallback(
    (key: "focus_domains" | "distraction_triggers" | "success_goals", value: string, max?: number) => {
      setForm((prev) => {
        const arr = prev[key].includes(value)
          ? prev[key].filter((v) => v !== value)
          : max !== undefined && prev[key].length >= max
            ? prev[key]
            : [...prev[key], value];
        return { ...prev, [key]: arr };
      });
    },
    []
  );

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coach_personality: form.coach_personality,
          focus_domains: form.focus_domains.length ? form.focus_domains : ["deep_work"],
          distraction_triggers: form.distraction_triggers,
          default_focus_minutes: form.default_focus_minutes,
          preferred_focus_time: form.preferred_focus_time,
          success_goals: form.success_goals.length ? form.success_goals : ["more_consistent"],
          custom_focus_domain: form.custom_focus_domain.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        setSubmitting(false);
        return;
      }
      router.replace("/dashboard?tab=coach");
    } catch {
      setError("Something went wrong");
      setSubmitting(false);
    }
  };

  const canNext =
    (step === 1 && form.coach_personality) ||
    (step === 2 && form.focus_domains.length > 0) ||
    (step === 3 && form.distraction_triggers.length > 0) ||
    (step === 4 && form.default_focus_minutes) ||
    (step === 5 && form.preferred_focus_time) ||
    (step === 6 && form.success_goals.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-lg">
        <a href="/" className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-8">
          <img src="/logo.svg" alt="" className="w-8 h-8" />
          <span className="font-heading font-semibold">deepwork.ai</span>
        </a>

        {/* Welcome screen (step 0) */}
        {step === 0 && (
          <div className="animate-float-gentle rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-card p-8 sm:p-10 text-center">
            <span className="inline-block text-4xl mb-4" aria-hidden>👋</span>
            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-3">Onboarding</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Welcome
            </h1>
            <p className="text-muted text-sm sm:text-base max-w-sm mx-auto mb-8">
              Your focus is about to get on a better journey. A few quick questions and we&apos;ll personalize your experience.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-primary px-8 py-3 text-base"
            >
              Start
            </button>
          </div>
        )}

        {step >= 1 && (
          <>
            <div className="mb-6 flex gap-2">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    s.id <= step ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                  aria-hidden
                />
              ))}
            </div>

            <h1 className="text-xl font-bold text-foreground mb-2">{STEPS[step - 1].title}</h1>
          </>
        )}

        {/* Step 1: Coach personality */}
        {step === 1 && (
          <div className="space-y-3 mt-6">
            <p className="text-sm text-muted mb-4">We&apos;ll use this to pick your coach personality so the tone fits what helps you most.</p>
            {COACH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, coach_personality: opt.value }))}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all ${
                  form.coach_personality === opt.value
                    ? "border-primary bg-primary-light dark:bg-primary/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Focus domains */}
        {step === 2 && (
          <div className="space-y-2 mt-6">
            <p className="text-sm text-muted mb-4">What do you mainly want to use this app for? (Select all that apply)</p>
            {FOCUS_DOMAIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleArray("focus_domains", opt.value)}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all ${
                  form.focus_domains.includes(opt.value)
                    ? "border-primary bg-primary-light dark:bg-primary/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
            {form.focus_domains.includes("other") && (
              <input
                type="text"
                placeholder="Describe something else (optional)"
                value={form.custom_focus_domain}
                onChange={(e) => setForm((p) => ({ ...p, custom_focus_domain: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>
        )}

        {/* Step 3: Distraction triggers (max 3) */}
        {step === 3 && (
          <div className="space-y-2 mt-6">
            <p className="text-sm text-muted mb-4">
              When you lose focus, what&apos;s usually the reason? (Pick up to 3)
            </p>
            {DISTRACTION_OPTIONS.map((opt) => {
              const selected = form.distraction_triggers.includes(opt.value);
              const disabled = !selected && form.distraction_triggers.length >= MAX_DISTRACTIONS;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleArray("distraction_triggers", opt.value, MAX_DISTRACTIONS)}
                  className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    selected
                      ? "border-primary bg-primary-light dark:bg-primary/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                  }`}
                >
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 4: Default focus length */}
        {step === 4 && (
          <div className="space-y-2 mt-6">
            <p className="text-sm text-muted mb-4">On a normal day, how long can you focus without drifting?</p>
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, default_focus_minutes: opt.value }))}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all ${
                  form.default_focus_minutes === opt.value
                    ? "border-primary bg-primary-light dark:bg-primary/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 5: Time of day */}
        {step === 5 && (
          <div className="space-y-2 mt-6">
            <p className="text-sm text-muted mb-4">When do you usually want to focus?</p>
            {TIME_OF_DAY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, preferred_focus_time: opt.value }))}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all ${
                  form.preferred_focus_time === opt.value
                    ? "border-primary bg-primary-light dark:bg-primary/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 6: Success goals */}
        {step === 6 && (
          <div className="space-y-2 mt-6">
            <p className="text-sm text-muted mb-4">What does “success” look like for you? (Select all that apply)</p>
            {SUCCESS_GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleArray("success_goals", opt.value)}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all ${
                  form.success_goals.includes(opt.value)
                    ? "border-primary bg-primary-light dark:bg-primary/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className={`mt-8 flex items-center justify-between gap-4 ${step === 0 ? "invisible h-0 mt-0 overflow-hidden" : ""}`}>
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          {step >= 1 && step < 6 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : step === 6 ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving…" : "Finish"}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
