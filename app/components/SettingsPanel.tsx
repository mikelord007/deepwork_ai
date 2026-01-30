"use client";

import { useEffect, useRef } from "react";
import { Moon, Sun, Monitor, X } from "lucide-react";
import { useTheme } from "@/lib/theme";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to avoid immediate close from the button click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const themeOptions: { value: "light" | "dark" | "system"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={panelRef}
        className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-float animate-modal-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Theme Section */}
        <div>
          <label className="text-sm font-medium text-muted mb-3 block">
            Appearance
          </label>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    isActive
                      ? "border-primary bg-primary-light dark:bg-primary/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-800"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? "text-primary" : "text-muted"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Additional settings can be added here */}
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-muted text-center">
            More settings coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
