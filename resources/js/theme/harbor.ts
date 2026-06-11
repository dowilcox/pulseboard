/**
 * Harbor design tokens — source of truth for the PulseBoard redesign.
 *
 * Values come from the Claude Design handoff (`CLAY_THEMES.harbor`) and have
 * passed a WCAG 2.1 AA contrast audit (4.5:1 text, 3:1 UI graphics).
 * Do not lighten `faint`, the copper tones, or the avatar colors.
 * Muted text on `well` surfaces must use `sub`, not `faint`.
 *
 * Tokens are oklch strings for direct use in `sx`/CSS. MUI's color utilities
 * (alpha, darken, …) cannot parse oklch, so `harborHex` mirrors every token
 * in sRGB hex for the MUI palette and anywhere a color gets manipulated.
 * Keep the two objects in sync.
 */

export const harbor = {
    // Neutrals (blue-slate)
    canvas: "oklch(88% 0.011 245)", // app/page background
    well: "oklch(84.5% 0.013 245)", // column wells (inset surfaces)
    card: "oklch(98.5% 0.004 240)", // cards, panels, inputs
    cardBorder: "oklch(93% 0.009 245)", // hairline dividers inside cards
    track: "oklch(91.5% 0.011 245)", // progress tracks, neutral chips on cards
    countBg: "oklch(92% 0.011 245)", // count badges, selects, comment wells, date chips
    ink: "oklch(28% 0.025 260)", // primary text
    sub: "oklch(45% 0.022 255)", // secondary text; muted text on wells
    faint: "oklch(48% 0.02 252)", // tertiary text — at the AA floor on canvas

    // Accents
    accent: "oklch(48% 0.13 265)", // indigo — buttons, links, progress, checkboxes
    accentDark: "oklch(40% 0.13 265)",
    secondary: "oklch(56% 0.13 50)", // copper — warning warmth, 70–94% workload
    secondaryDot: "oklch(55% 0.13 50)", // In Progress column dot, High-priority dot
    danger: "oklch(53% 0.17 25)", // ≥95% workload, Blocked pill bg
    dangerText: "oklch(48% 0.16 25)", // Delete action text on card
    success: "oklch(52% 0.11 155)", // <70% workload, Done dot
    successText: "oklch(42% 0.1 155)", // positive deltas

    // Column dots
    colDots: {
        backlog: "oklch(52% 0.02 250)",
        todo: "oklch(48% 0.13 265)",
        progress: "oklch(55% 0.13 50)",
        done: "oklch(52% 0.11 155)",
    },

    // Due-soon chip
    dueSoon: { fg: "oklch(44% 0.11 50)", bg: "oklch(92% 0.055 55)" },

    // Status pills (fg on pale bg)
    status: {
        backlog: { fg: "oklch(45% 0.022 255)", bg: "oklch(92% 0.011 245)" },
        todo: { fg: "oklch(40% 0.1 265)", bg: "oklch(92% 0.045 265)" },
        inProgress: { fg: "oklch(42% 0.1 50)", bg: "oklch(92% 0.055 55)" },
        done: { fg: "oklch(40% 0.09 155)", bg: "oklch(92% 0.05 155)" },
    },

    // Label pills — tinted: dark fg on pale bg of the same hue
    labels: {
        enhancement: { fg: "oklch(40% 0.09 215)", bg: "oklch(92% 0.045 215)" },
        newFeature: { fg: "oklch(40% 0.1 300)", bg: "oklch(92% 0.05 300)" },
        security: { fg: "oklch(42% 0.1 75)", bg: "oklch(92% 0.06 80)" },
        needsTesting: { fg: "oklch(42% 0.1 50)", bg: "oklch(92% 0.055 55)" },
        blocked: { fg: "oklch(98% 0.005 30)", bg: "oklch(53% 0.17 25)" },
    },

    // Tinted icon chips (dashboard stat cards)
    tints: {
        indigo: { fg: "oklch(40% 0.1 265)", bg: "oklch(92% 0.045 265)" },
        red: { fg: "oklch(42% 0.12 25)", bg: "oklch(92% 0.05 25)" },
        green: { fg: "oklch(40% 0.09 155)", bg: "oklch(92% 0.05 155)" },
        copper: { fg: "oklch(42% 0.1 50)", bg: "oklch(92% 0.055 55)" },
    },

    // Elevation
    cardShadow:
        "0 4px 14px -6px oklch(40% 0.03 60 / 0.18), 0 1px 2px oklch(40% 0.03 60 / 0.08)",
    cardShadowHover:
        "0 6px 18px -6px oklch(40% 0.03 60 / 0.18), 0 1px 2px oklch(40% 0.03 60 / 0.08)",
    chipShadow: "0 1px 2px oklch(40% 0.03 60 / 0.1)",

    // Typography
    headingFont: '"Bricolage Grotesque", "Helvetica Neue", "Arial", sans-serif',
    bodyFont: '"Schibsted Grotesk", "Helvetica Neue", "Arial", sans-serif',

    // Geometry
    radius: {
        well: 18,
        card: 14,
        panel: 16,
        tile: 12,
        control: 10,
        checkbox: 6,
        pill: 999,
    },
} as const;

/**
 * sRGB hex mirrors of the oklch tokens above (exact conversions) — use these
 * for the MUI palette and anywhere MUI may run color math on the value.
 */
export const harborHex = {
    canvas: "#d2d8de",
    well: "#c5cdd4",
    card: "#f8fafd",
    cardBorder: "#e3e9ee",
    track: "#dde4ea",
    countBg: "#dfe5ec",
    ink: "#222935",
    sub: "#4d5662",
    faint: "#565f69",
    accent: "#3959a6",
    accentLight: "#5477c7",
    accentDark: "#24418d",
    secondary: "#af5a21",
    danger: "#ba3535",
    dangerText: "#a5292b",
    success: "#267b4c",
    successText: "#095c34",
} as const;

/** Avatar fallback colors — white initials, contrast-audited (≥4.5:1). */
export const harborAvatarColors = [
    "#b43d7a",
    "#3a66b5",
    "#2f7d52",
    "#8f6e2a",
] as const;

/** Deterministic avatar color for a user (stable across the app). */
export function harborAvatarColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return harborAvatarColors[Math.abs(hash) % harborAvatarColors.length];
}
