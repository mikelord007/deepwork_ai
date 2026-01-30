"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Mic, Send } from "lucide-react";

const PROMPT_SUGGESTIONS = [
  "What are my main distraction patterns this week?",
  "When do I focus best? Give me a summary.",
  "How can I improve my completion rate?",
  "Summarize my focus sessions from the last 7 days.",
  "Why do I keep abandoning sessions around the same time?",
  "Suggest a focus schedule based on my metrics.",
];

// Web Speech API types (not in all TS envs)
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  item(i: number): SpeechRecognitionResult;
  [i: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  length: number;
  item(i: number): SpeechRecognitionAlternative;
  [i: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionErrorEvent {
  error: string;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export default function CoachTab() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showMicPermissionPrompt, setShowMicPermissionPrompt] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseInputRef = useRef("");
  const hasMicPermissionBeenGrantedRef = useRef(false);

  // Detect speech support after mount to avoid hydration mismatch (window is undefined on server)
  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      hasMicPermissionBeenGrantedRef.current = true;
      setShowMicPermissionPrompt(false);
      setMicPermissionDenied(false);
      setIsListening(true);
    };

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let fullTranscript = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = (result[0] as SpeechRecognitionAlternative)?.transcript ?? "";
        if (result.isFinal) {
          fullTranscript += (fullTranscript ? " " : "") + transcript;
        } else {
          interim = transcript;
        }
      }
      let s = baseInputRef.current;
      if (fullTranscript) s += (s ? " " : "") + fullTranscript;
      if (interim) s += (s ? " " : "") + interim;
      setInput(s);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        setShowMicPermissionPrompt(false);
        setMicPermissionDenied(true);
      }
      if (e.error !== "aborted") {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, []);

  const toggleVoiceInput = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (isListening) {
      rec.stop();
      return;
    }
    baseInputRef.current = input;
    if (!hasMicPermissionBeenGrantedRef.current) {
      setShowMicPermissionPrompt(true);
      setMicPermissionDenied(false);
    }
    rec.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    // Placeholder: no AI yet, could add "Thinking..." or a coming-soon reply
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "AI insights are coming soon. Your focus data will power personalized advice here.",
      },
    ]);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="min-h-[calc(100vh-120px)] md:min-h-screen flex flex-col justify-center max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Focus Coach</h2>
          <p className="text-sm text-muted">Ask about your sessions, patterns, and get insights</p>
        </div>
      </div>

      {/* Chat area */}
      {messages.length > 0 && (
        <div className="space-y-4 mb-8">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-foreground"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input + suggestions (ChatGPT-style) */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask about your focus sessions, patterns, or get advice..."
            rows={3}
            className={`w-full resize-none rounded-2xl border bg-white px-4 py-3 pr-24 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all ${
              isListening ? "border-accent/50 ring-1 ring-accent/20" : "border-gray-200"
            }`}
          />
          {/* Mic permission prompt when we need access and user clicked mic */}
          {showMicPermissionPrompt && !isListening && (
            <div className="absolute left-4 right-14 bottom-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              We need access to your microphone. Please allow it in your browser so we can start using the microphone.
            </div>
          )}
          {micPermissionDenied && !isListening && (
            <div className="absolute left-4 right-14 bottom-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
              Microphone access was denied. Please allow it in your browser settings to use voice input.
            </div>
          )}
          {/* Voice listening indicator - waveform bars (only when actually listening) */}
          {isListening && (
            <div className="absolute left-4 bottom-4 flex items-end gap-0.5 h-5 pointer-events-none" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <span
                  key={i}
                  className="w-1 min-h-2 rounded-full bg-accent animate-voice-bar"
                  style={{
                    animationDelay: `${i * 0.08}s`,
                  }}
                />
              ))}
            </div>
          )}
          <div className="absolute right-3 bottom-3 flex items-center gap-1">
            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  isListening
                    ? "bg-accent text-white hover:bg-emerald-600"
                    : "bg-gray-100 text-foreground hover:bg-gray-200"
                }`}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prompt suggestions */}
        <div>
          <p className="text-xs text-muted mb-2">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-primary-light text-left text-sm text-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
