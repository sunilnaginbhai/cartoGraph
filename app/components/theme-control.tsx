"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const storageKey = "cartograph-theme";

const options: ReadonlyArray<{ label: string; value: ThemePreference }> = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

function resolveTheme(preference: ThemePreference) {
  if (preference !== "system") {
    return preference;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolveTheme(preference);
}

export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const savedPreference = localStorage.getItem(storageKey);
    return options.some((option) => option.value === savedPreference)
      ? (savedPreference as ThemePreference)
      : "system";
  });

  useEffect(() => {
    applyTheme(preference);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (preference === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, [preference]);

  function selectTheme(nextPreference: ThemePreference) {
    localStorage.setItem(storageKey, nextPreference);
    setPreference(nextPreference);
    applyTheme(nextPreference);
  }

  return (
    <div aria-label="Color theme" className="theme-control" role="group">
      {options.map((option) => (
        <button
          aria-pressed={preference === option.value}
          className="theme-option"
          key={option.value}
          onClick={() => selectTheme(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
