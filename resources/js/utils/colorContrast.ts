/**
 * Computes WCAG-compliant contrast text color for a given background.
 *
 * Uses the sRGB relative-luminance formula (WCAG 2.x) and returns whichever
 * of dark or light text has the stronger contrast against the background.
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
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "#000";

    const toLinear = (c: number) => {
        const srgb = c / 255;
        return srgb <= 0.03928
            ? srgb / 12.92
            : Math.pow((srgb + 0.055) / 1.055, 2.4);
    };

    const luminance =
        0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    const contrastWithWhite = 1.05 / (luminance + 0.05);
    const contrastWithDark = (luminance + 0.05) / 0.05;

    return contrastWithDark > contrastWithWhite ? "#000" : "#fff";
}
