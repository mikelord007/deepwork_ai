"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MetricsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?tab=metrics");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted">Redirecting to dashboard...</p>
    </div>
  );
}
