import { useState, useEffect } from "react";

interface Preferences {
  lastPostItColor?: string;
  lastTextFont?: string;
  lastTextLineHeight?: number;
  lastTextBold?: boolean;
  lastTextItalic?: boolean;
  lastTextColor?: string;
  lastTextAlign?: "left" | "center" | "right";
  lastTextShadow?: boolean;
  // Add more preferences here as needed
}

const PREFERENCES_KEY = "briefboarder-preferences";

const defaultPreferences: Preferences = {
  lastPostItColor: "#FEFF9C", // Classic yellow
  lastTextFont: "var(--font-geist-sans)",
  lastTextLineHeight: 1.2,
  lastTextBold: false,
  lastTextItalic: false,
  lastTextColor: "#000000",
  lastTextAlign: "left",
  lastTextShadow: false,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  }, []);

  // Update a specific preference
  const updatePreference = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save preference:", error);
      }
      return updated;
    });
  };

  return {
    preferences,
    updatePreference,
  };
}
