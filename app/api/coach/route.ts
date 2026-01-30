import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getCoachContext } from "@/lib/coach-context";

const SYSTEM_PROMPT = `You are a friendly, concise Focus Coach. You help the user understand their focus session data and give actionable advice. Use only the user data provided below—do not invent numbers. If they have no or little data, say so and suggest they run more focus sessions. Keep replies brief (2–4 short paragraphs) and encouraging.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const userId = typeof body?.userId === "string" ? body.userId : "default-user";

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const context = await getCoachContext(userId);
    const prompt = `${SYSTEM_PROMPT}\n\n---\n${context}\n---\n\nUser question: ${message}`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });

    const text = response.text ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "No response from model" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("[Coach API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Coach request failed" },
      { status: 500 }
    );
  }
}
