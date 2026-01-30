"use client";

import { useState, useRef, useEffect } from "react";

const EMAIL = "manujasan23@gmail.com";
const PHONE = "+91 730 645 3104";

export default function CoBuildButton() {
  const [showContact, setShowContact] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showContact) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowContact(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showContact]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowContact(!showContact)}
        className="inline-flex items-center justify-center gap-2 border border-gray-600 text-white font-medium rounded-full px-5 py-2.5 transition-all duration-200 hover:bg-gray-800"
      >
        I want to co-build
      </button>
      {showContact && (
        <div className="absolute left-0 top-full z-10 mt-2 min-w-[240px] rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 shadow-lg">
          <p className="text-xs text-gray-400 mb-2">Get in touch with the founder</p>
          <p className="text-sm text-white">
            <span className="text-gray-400">Email:</span>{" "}
            <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
              {EMAIL}
            </a>
          </p>
          <p className="text-sm text-white mt-1">
            <span className="text-gray-400">Phone:</span>{" "}
            <a href={`tel:+917306453104`} className="text-primary hover:underline">
              {PHONE}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
