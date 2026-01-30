"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Settings,
  Zap,
} from "lucide-react";
import CoachTab from "./CoachTab";
import FocusTab from "./FocusTab";
import MetricsTab from "./MetricsTab";

type TabId = "coach" | "focus" | "metrics";

const NAV_ITEMS: { id: TabId; label: string; icon: typeof MessageCircle }[] = [
  { id: "coach", label: "Coach", icon: MessageCircle },
  { id: "focus", label: "Focus", icon: Zap },
  { id: "metrics", label: "Metrics", icon: BarChart3 },
];

function DashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && NAV_ITEMS.some((t) => t.id === tabParam) ? tabParam : "coach"
  );
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    if (tabParam && NAV_ITEMS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  return (
    <div className="min-h-screen bg-background">
      {/* ===== MOBILE: Header + Pill Tabs ===== */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center justify-between px-4 h-14">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="w-8 h-8 flex-shrink-0" />
              <span className="font-heading font-semibold text-foreground text-sm">
                deepwork.ai
              </span>
            </a>
            <button
              type="button"
              className="p-2 text-muted hover:text-foreground transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Pill/Segment Tabs */}
          <div className="px-4 pb-3">
            <div className="flex bg-gray-100 rounded-xl p-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>
      </div>

      {/* ===== DESKTOP: Sidebar ===== */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-full bg-white border-r border-gray-100 z-40 flex-col transition-all duration-200 ${
          sidebarExpanded ? "w-52" : "w-16"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-gray-100 px-3">
          <a href="/" className="flex items-center gap-2 overflow-hidden">
            <img src="/logo.svg" alt="" className="w-9 h-9 flex-shrink-0" />
            {sidebarExpanded && (
              <span className="font-heading font-semibold text-foreground whitespace-nowrap">
                deepwork.ai
              </span>
            )}
          </a>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-soft"
                    : "text-muted hover:bg-gray-100 hover:text-foreground"
                }`}
                title={!sidebarExpanded ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-100 p-2 space-y-1">
          {/* Settings */}
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted hover:bg-gray-100 hover:text-foreground transition-all"
            title={!sidebarExpanded ? "Settings" : undefined}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {sidebarExpanded && (
              <span className="text-sm font-medium whitespace-nowrap">Settings</span>
            )}
          </button>

          {/* Expand/Collapse toggle */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted hover:bg-gray-100 hover:text-foreground transition-all"
            title={sidebarExpanded ? "Collapse" : "Expand"}
          >
            {sidebarExpanded ? (
              <>
                <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">Collapse</span>
              </>
            ) : (
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            )}
          </button>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      {/* Mobile: no margin, Desktop: margin for sidebar */}
      <main
        className={`min-h-screen transition-all duration-200 ${
          sidebarExpanded ? "md:ml-52" : "md:ml-16"
        }`}
      >
        <div className="max-w-5xl mx-auto">
          {activeTab === "coach" && <CoachTab />}
          {activeTab === "focus" && <FocusTab />}
          {activeTab === "metrics" && <MetricsTab />}
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-muted">
          Loading...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
