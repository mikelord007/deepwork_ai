import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8F9FC",
        foreground: "#1A1A2E",
        primary: {
          DEFAULT: "#7C6AFF",
          light: "#EDE9FF",
          dark: "#5B4CD4",
          foreground: "#FFFFFF"
        },
        accent: {
          DEFAULT: "#10B981",
          light: "#D1FAE5"
        },
        muted: {
          DEFAULT: "#6B7280",
          foreground: "#9CA3AF"
        }
      },
      fontFamily: {
        heading: ["'DM Sans'", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "'DM Sans'", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 8px 30px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 16px 40px rgba(0, 0, 0, 0.1)",
        float: "0 20px 50px rgba(0, 0, 0, 0.12)",
        soft: "0 4px 12px rgba(0, 0, 0, 0.06)"
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
        "5xl": "32px"
      }
    }
  },
  plugins: []
};

export default config;
