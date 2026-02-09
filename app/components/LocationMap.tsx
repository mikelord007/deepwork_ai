"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export interface LocationStats {
  label: string;
  lat: number;
  lon: number;
  total: number;
  completed: number;
  completionRate: number;
}

function escapeHtml(text: string): string {
  if (typeof document === "undefined") return text;
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export default function LocationMap({ locations }: { locations: LocationStats[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || locations.length === 0 || !containerRef.current) return;
    const el = containerRef.current;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || mapRef.current) return;

      const markerIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const centerLat = locations.reduce((s, l) => s + l.lat, 0) / locations.length;
      const centerLon = locations.reduce((s, l) => s + l.lon, 0) / locations.length;
      const map = L.map(el, { scrollWheelZoom: false }).setView(
        [centerLat, centerLon],
        locations.length === 1 ? 14 : 12
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      locations.forEach((loc) => {
        const popup = L.popup().setContent(
          `<span class="font-semibold">${escapeHtml(loc.label)}</span><br/>${loc.completionRate}% completion (${loc.completed}/${loc.total} sessions)`
        );
        L.marker([loc.lat, loc.lon], { icon: markerIcon }).addTo(map).bindPopup(popup);
      });

      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      if (mapRef.current && typeof (mapRef.current as { remove: () => void }).remove === "function") {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [mounted, locations]);

  if (locations.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 z-0"
      style={{ visibility: mounted ? "visible" : "hidden" }}
    />
  );
}
