// Theme choice: "dark" by default, or "light". The choice is kept in the browser.
export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";
export const THEME_STORAGE_KEY = "escrow-theme";
export const THEME_CHANGE_EVENT = "escrow-theme-change";

export type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

// Anything other than "light" means the default theme.
export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" ? "light" : DEFAULT_THEME;
}

// Storage can be unavailable (for example in private browsing), so reads fall back to the default.
export function readStoredTheme(storage: ThemeStorage | null): Theme {
  try {
    return parseTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

// A failed save is ignored. The theme still changes for this visit.
export function saveTheme(storage: ThemeStorage | null, theme: Theme): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage is unavailable. Nothing else to do.
  }
}

// Returns the browser's local storage, or null if the browser blocks access to it.
export function getThemeStorage(): ThemeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

// Runs before the first paint. It only needs to act on the light theme,
// because dark is the default in the stylesheet.
export const themeInitScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})==="light"){document.documentElement.setAttribute("data-theme","light");document.documentElement.style.colorScheme="light";}}catch(e){}})();`;
