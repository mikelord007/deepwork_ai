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
      const focusData = await getCoachContext(userId, supabase);
      if (focusData) systemContent += "\n\n" + focusData;
    }

    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemContent },
      { role: "user", content: message },
    ];

    let lastContent: string | null = null;
    let iterations = 0;

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

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[Coach API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Coach request failed" },
      { status: 500 }
    );
  }
}
