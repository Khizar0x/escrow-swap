import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  parseTheme,
  readStoredTheme,
  saveTheme,
  themeInitScript,
  type ThemeStorage,
} from "./theme";

function fakeStorage(initial: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function brokenStorage(): ThemeStorage {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
}

describe("parseTheme", () => {
  it("accepts light and treats everything else as the default", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("blue")).toBe(DEFAULT_THEME);
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
  });
});

describe("readStoredTheme", () => {
  it("returns the saved theme", () => {
    expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: "light" }))).toBe("light");
  });

  it("defaults to dark when nothing is saved", () => {
    expect(readStoredTheme(fakeStorage())).toBe("dark");
  });

  it("defaults to dark when storage is missing or blocked", () => {
    expect(readStoredTheme(null)).toBe("dark");
    expect(readStoredTheme(brokenStorage())).toBe("dark");
  });
});

describe("saveTheme", () => {
  it("writes the chosen theme", () => {
    const storage = fakeStorage();
    saveTheme(storage, "light");
    expect(storage.data[THEME_STORAGE_KEY]).toBe("light");
  });

  it("does not throw when storage is missing or blocked", () => {
    expect(() => saveTheme(null, "light")).not.toThrow();
    expect(() => saveTheme(brokenStorage(), "light")).not.toThrow();
  });
});

describe("themeInitScript", () => {
  it("reads the same storage key the app writes", () => {
    expect(themeInitScript).toContain(`"${THEME_STORAGE_KEY}"`);
  });
});
