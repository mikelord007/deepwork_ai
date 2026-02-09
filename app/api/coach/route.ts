import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import {
  COACH_SYSTEM_PROMPT,
  getPersonalityTone,
  formatPreferencesForCoach,
  type UserPreferencesForCoach,
  type CoachPersonality,
} from "@/lib/coach-prompts";
import { getCoachContext } from "@/lib/coach-context";
import { COACH_TOOLS, executeCoachTool } from "@/lib/coach-tools";
import { getOpik, flushOpik } from "@/lib/opik";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const MAX_TOOL_ITERATIONS = 10;

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type OpenRouterResponseMessage = {
  content?: string | null;
  tool_calls?: ToolCall[];
};

type OpenRouterChoice = {
  message: OpenRouterResponseMessage;
  finish_reason?: string;
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    let systemContent = COACH_SYSTEM_PROMPT;
    const { data: prefsRow } = await supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
    if (prefsRow) {
      const tone = getPersonalityTone((prefsRow.coach_personality as CoachPersonality) ?? "data_focused");
      const contextBlock = formatPreferencesForCoach(prefsRow as UserPreferencesForCoach);
      if (tone) systemContent += "\n\n" + tone;
      if (contextBlock) systemContent += "\n\nUser context:\n" + contextBlock;
    }
    const focusData = await getCoachContext(userId, supabase);
    if (focusData) systemContent += "\n\n" + focusData;
    systemContent += `\n\nWhen calling tools, use this user_id: "${userId}". Answer using the "User focus data" section above when it contains what the user asked (e.g. completion rate, distractions, session counts). Use tools when you need extra detail: get_focus_trends (daily breakdown), get_best_focus_windows (best hours), get_distractions_by_location (distractions at home/office/cafe). Do not say you lack location-specific data without calling get_distractions_by_location first. Do not ask the user for their ID or for data that is already in the focus data above.`;

    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemContent },
      { role: "user", content: message },
    ];

    const opik = getOpik();
    const trace = opik?.trace({ name: "Coach chat", input: { message } });

    let lastContent: string | null = null;
    let iterations = 0;

    try {
      while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: COACH_TOOLS,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("[Coach API] OpenRouter error", res.status, errBody);
        return NextResponse.json(
          { error: `OpenRouter request failed: ${res.status}` },
          { status: 502 }
        );
      }

      const data = (await res.json()) as {
        choices?: OpenRouterChoice[];
      };
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        return NextResponse.json(
          { error: "No response from model" },
          { status: 500 }
        );
      }

      lastContent = msg.content ?? null;

      if (trace) {
        const span = trace.span({
          name: "OpenRouter",
          type: "llm",
          input: { model: MODEL, messageCount: messages.length },
          output: {
            content: msg.content ?? undefined,
            tool_calls: msg.tool_calls?.length,
          },
        });
        span.end();
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({
          role: "assistant",
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        });

        for (const tc of msg.tool_calls) {
          let toolResult: string;
          try {
            const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
            toolResult = supabase
              ? await executeCoachTool(supabase, tc.function.name, args, userId)
              : JSON.stringify({ error: "Supabase not configured" });
          } catch (e) {
            toolResult = JSON.stringify({
              error: e instanceof Error ? e.message : "Tool execution failed",
            });
          }
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResult,
          });
        }
        continue;
      }

      break;
    }

      const reply = (lastContent ?? "").trim();
      if (!reply) {
        return NextResponse.json(
          { error: "No reply from model" },
          { status: 500 }
        );
      }

      trace?.update({ output: { reply } });
      return NextResponse.json({ reply });
    } finally {
      trace?.end();
      await flushOpik();
    }
  } catch (err) {
    console.error("[Coach API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Coach request failed" },
      { status: 500 }
    );
  }
}
