import type { SupabaseClient } from "@supabase/supabase-js";

export const COACH_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_focus_trends",
      description: "Get daily focus stats and trends for the user for the last N days (sessions, completed, focus minutes, distractions).",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User identifier" },
          days: { type: "integer", description: "Number of days to include (default 30)", default: 30 },
        },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_best_focus_windows",
      description: "Get focus windows by hour and day of week (when the user starts/completes sessions and completion rate).",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User identifier" },
        },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_distraction_patterns",
      description: "Get distraction counts by type and average minutes into session when they occur.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User identifier" },
        },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_focus_by_location",
      description: "Get focus stats by place (Office, Cafe, Home, Other): total sessions, completed, completion rate. Ordered best to worst by completion rate.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User identifier" },
        },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_recent_changes",
      description: "Get recent coach insights or logged notes for the user for the last N days.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User identifier" },
          days: { type: "integer", description: "Number of days to look back (default 14)", default: 14 },
        },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_coach_insight",
      description: "Log an insight or recommendation for the user so it can be recalled later (e.g. summary or experiment suggestion).",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User identifier" },
          type: { type: "string", description: "Short type label (e.g. insight, experiment, summary)" },
          content: { type: "string", description: "Content of the insight" },
        },
        required: ["user_id", "type", "content"],
      },
    },
  },
];

export async function executeCoachTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<string> {
  const uid = (args.user_id as string) ?? userId;

  switch (toolName) {
    case "get_focus_trends": {
      const days = typeof args.days === "number" ? args.days : 30;
      const { data, error } = await supabase.rpc("get_focus_trends", {
        p_user_id: uid,
        p_days: days,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data ?? {});
    }
    case "get_best_focus_windows": {
      const { data, error } = await supabase.rpc("get_best_focus_windows", {
        p_user_id: uid,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data ?? {});
    }
    case "get_distraction_patterns": {
      const { data, error } = await supabase.rpc("get_distraction_patterns", {
        p_user_id: uid,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data ?? {});
    }
    case "get_focus_by_location": {
      const { data, error } = await supabase.rpc("get_focus_by_location", {
        p_user_id: uid,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data ?? {});
    }
    case "get_recent_changes": {
      const days = typeof args.days === "number" ? args.days : 14;
      const { data, error } = await supabase.rpc("get_recent_changes", {
        p_user_id: uid,
        p_days: days,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data ?? {});
    }
    case "log_coach_insight": {
      const type = typeof args.type === "string" ? args.type : "insight";
      const content = typeof args.content === "string" ? args.content : "";
      const { error } = await supabase.from("coach_memory").insert({
        user_id: uid,
        type,
        content,
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ ok: true, message: "Insight logged." });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
