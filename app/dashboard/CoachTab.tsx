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
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showMicPermissionPrompt, setShowMicPermissionPrompt] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseInputRef = useRef("");
  const hasMicPermissionBeenGrantedRef = useRef(false);
  const sessionStableRef = useRef("");

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
      sessionStableRef.current = "";
    };

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const lastIdx = e.results.length - 1;
      const lastResult = e.results[lastIdx];
      const transcript = (lastResult[0] as SpeechRecognitionAlternative)?.transcript ?? "";
      const isFinal = lastResult.isFinal;
      const base = baseInputRef.current;
      const stable = sessionStableRef.current;

      if (isFinal) {
        const trimmedStable = stable.trim();
        if (!trimmedStable || transcript.trim().startsWith(trimmedStable)) {
          sessionStableRef.current = transcript;
        } else {
          sessionStableRef.current = trimmedStable + " " + transcript.trim();
        }
      }

      const currentStable = sessionStableRef.current;
      let display: string;
      if (isFinal) {
        display = base ? base + " " + currentStable : currentStable;
      } else {
        const trimmedStable = currentStable.trim();
        if (!trimmedStable || transcript.trim().startsWith(trimmedStable)) {
          display = base ? base + " " + transcript : transcript;
        } else {
          display = base ? base + " " + trimmedStable + " " + transcript : trimmedStable + " " + transcript;
        }
      }
      setInput(display);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userId: "default-user" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data?.error ?? `Request failed (${res.status})`,
          },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "No reply." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0 || isLoading;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (hasMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, hasMessages]);

  return (
    <div
      className={`flex flex-col max-w-3xl mx-auto px-4 ${
        hasMessages
          ? "h-[calc(100vh-120px)] md:h-screen"
          : "min-h-[calc(100vh-120px)] md:min-h-screen justify-center py-8"
      }`}
    >
      {/* Header - hidden on mobile when chat is active */}
      <div className={
        hasMessages 
          ? "hidden md:block py-4 border-b border-gray-100" 
          : "mb-8"
      }>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Focus Coach</h2>
            <p className="text-sm text-muted">Ask about your sessions, patterns, and get insights</p>
          </div>
        </div>
      </div>

      {/* Scrollable chat area - only visible when there are messages */}
      {hasMessages && (
        <div className="flex-1 overflow-y-auto py-4 pr-4 -mr-4 space-y-4 scrollbar-thin">
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
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-100 text-foreground">
                <p className="text-sm text-muted">Thinking…</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input form - always rendered, styling changes based on state */}
      <div className={hasMessages ? "py-4 border-t border-gray-100" : ""}>
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
              className={`w-full resize-none rounded-2xl border bg-white px-5 py-4 pr-24 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all ${
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
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Prompt suggestions - only shown when no messages */}
          {!hasMessages && (
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
          )}
        </form>
      </div>
    </div>
  );
}
