import { describe, expect, it } from "vitest";
import { getContrastText } from "./colorContrast";

describe("getContrastText", () => {
    it("returns dark text for light backgrounds", () => {
        expect(getContrastText("#ffffff")).toBe("rgba(0,0,0,0.87)");
    });

    it("returns light text for dark backgrounds", () => {
        expect(getContrastText("#101828")).toBe("#fff");
    });

    it("falls back to dark text for invalid values", () => {
        expect(getContrastText("not-a-color")).toBe("rgba(0,0,0,0.87)");
    });
});
