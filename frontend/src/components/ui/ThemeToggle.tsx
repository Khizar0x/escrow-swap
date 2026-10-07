"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import {
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  applyTheme,
  getThemeStorage,
  saveTheme,
  type Theme,
} from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

// The page's current theme, read from the root element.
function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// The server has no saved theme, so it renders the default.
function getServerTheme(): Theme {
  return DEFAULT_THEME;
}

// A round button that switches between the dark and light themes.
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function handleClick() {
    applyTheme(document.documentElement, next);
    saveTheme(getThemeStorage(), next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Switch to ${next} theme`}
      className="inline-flex size-10 flex-none items-center justify-center rounded-full border border-control bg-surface text-ink transition-colors duration-200 ease-out hover:bg-raised"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
