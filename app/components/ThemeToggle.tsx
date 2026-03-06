"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      setDark(false);
      document.documentElement.classList.add("light-mode");
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.remove("light-mode");
    } else {
      document.documentElement.classList.add("light-mode");
    }
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="fixed bottom-20 md:bottom-5 right-5 z-50 p-3 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 group"
      style={{
        background: dark
          ? "linear-gradient(135deg, rgba(18, 28, 52, 0.9), rgba(14, 21, 41, 0.9))"
          : "linear-gradient(135deg, #fef9c3, #fde68a)",
        border: dark ? "1px solid rgba(6, 214, 160, 0.12)" : "1px solid rgba(251, 191, 36, 0.3)",
        boxShadow: dark
          ? "0 0 16px rgba(6, 214, 160, 0.1), 0 4px 12px rgba(0,0,0,0.3)"
          : "0 0 16px rgba(251, 191, 36, 0.15), 0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      {dark ? (
        <Moon size={20} className="text-[var(--accent)] group-hover:text-[var(--accent-bright)] transition-colors" />
      ) : (
        <Sun size={20} className="text-amber-600 group-hover:text-amber-500 transition-colors" />
      )}
    </button>
  );
}
