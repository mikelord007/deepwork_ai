/**
 * Personal Focus Agent: display names and shared constants.
 * Map coach_personality (internal) to the agent name shown in the UI.
 */
import type { CoachPersonality } from "./coach-prompts";

/**
 * Phase 3: Context-aware durations (rule-based).
 * When focus_sessions include task_type, energy_level, time_of_day, segment
 * sessions by baseline and run the same suggestion rules per segment.
 */
export type FocusContextBaseline =
  | "deep_work"      // default / heavy focus
  | "light_admin"    // light / admin tasks
  | "late_night";    // time-of-day based

export const AGENT_DISPLAY_NAMES: Record<CoachPersonality, string> = {
  strict: "Alex",
  data_focused: "Morgan",
  encouraging: "Sam",
};

export function getAgentDisplayName(personality: CoachPersonality | null | undefined): string {
  if (personality && personality in AGENT_DISPLAY_NAMES) {
    return AGENT_DISPLAY_NAMES[personality as CoachPersonality];
  }
  return "Focus Agent";
}
