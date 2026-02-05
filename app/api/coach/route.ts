import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getCoachContext } from "@/lib/coach-context";

const SYSTEM_PROMPT = `You are a supportive, concise Focus Coach. Your job is to help users interpret their focus session data and turn it into clear, practical next steps. Base all insights strictly on the data provided—never infer or fabricate metrics.

If the user has limited or no data, explicitly say so and encourage them to run more focus sessions before drawing conclusions.

Keep responses to exactly three short sections, each consisting of 1-3 sentences. Prioritize actionable advice, highlight one or two key patterns at most, and maintain a calm, encouraging coaching tone.`

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
