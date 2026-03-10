export function getCrepeThemeVars(
    isDark: boolean,
    transparentBg = false,
): Record<string, string> {
    return {
        "--crepe-color-background": transparentBg
            ? "transparent"
            : isDark
              ? "#1f1f1f"
              : "#ffffff",
        "--crepe-color-on-background": isDark
            ? "rgba(255,255,255,0.87)"
            : "rgba(0,0,0,0.87)",
        "--crepe-color-surface": isDark ? "#262626" : "#f5f5f5",
        "--crepe-color-surface-low": isDark ? "#1a1a1a" : "#fafafa",
        "--crepe-color-on-surface": isDark
            ? "rgba(255,255,255,0.70)"
            : "rgba(0,0,0,0.70)",
        "--crepe-color-on-surface-variant": isDark
            ? "rgba(255,255,255,0.55)"
            : "rgba(0,0,0,0.55)",
        "--crepe-color-outline": isDark
            ? "rgba(255,255,255,0.16)"
            : "rgba(0,0,0,0.23)",
        "--crepe-color-primary": isDark ? "#818cf8" : "#6366f1",
        "--crepe-color-secondary": isDark
            ? "rgba(129,140,248,0.15)"
            : "rgba(99,102,241,0.10)",
        "--crepe-color-on-secondary": isDark ? "#a5b4fc" : "#4f46e5",
        "--crepe-color-inverse": isDark ? "#e5e5e5" : "#1a1a1a",
        "--crepe-color-on-inverse": isDark ? "#1a1a1a" : "#e5e5e5",
        "--crepe-color-inline-code": isDark ? "#a5b4fc" : "#6366f1",
        "--crepe-color-error": isDark ? "#f87171" : "#dc2626",
        "--crepe-color-hover": isDark ? "#2e2e2e" : "#f0f0f0",
        "--crepe-color-selected": isDark
            ? "rgba(129,140,248,0.18)"
            : "rgba(99,102,241,0.12)",
        "--crepe-color-inline-area": isDark ? "#2b2b2b" : "#e8e8e8",
        "--crepe-font-title":
            '"Inter", "Helvetica Neue", "Arial", sans-serif',
        "--crepe-font-default":
            '"Inter", "Helvetica Neue", "Arial", sans-serif',
        "--crepe-font-code": '"Fira Code", "JetBrains Mono", monospace',
    };
}

export const crepeHeadingSx = {
    "&:first-of-type": { marginTop: 0 },
    marginTop: "12px",
};
