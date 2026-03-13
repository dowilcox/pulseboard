/**
 * Computes WCAG-compliant contrast text color for a given background.
 *
 * Uses the sRGB relative-luminance formula (WCAG 2.x) with a 0.179
 * threshold — the standard crossover point for AA-level contrast.
 */
export function getContrastText(hexColor: string): string {
    const hex = hexColor.replace("#", "");

    // Expand shorthand (#fff -> ffffff)
    const fullHex =
        hex.length === 3
            ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
            : hex;

    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);

    // Return fallback for invalid input
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "rgba(0,0,0,0.87)";

    const toLinear = (c: number) => {
        const srgb = c / 255;
        return srgb <= 0.03928
            ? srgb / 12.92
            : Math.pow((srgb + 0.055) / 1.055, 2.4);
    };

    const luminance =
        0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    return luminance > 0.179 ? "rgba(0,0,0,0.87)" : "#fff";
}
