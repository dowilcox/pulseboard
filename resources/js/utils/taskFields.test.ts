import { describe, expect, it } from "vitest";
import {
    dueDateHint,
    parseEffortInput,
    singleLineTitle,
    toDateInputValue,
} from "./taskFields";

describe("toDateInputValue", () => {
    it("keeps the calendar day of a date-only string", () => {
        expect(toDateInputValue("2026-03-24")).toBe("2026-03-24");
    });

    it("drops a time component without shifting the day", () => {
        expect(toDateInputValue("2026-03-24T00:00:00.000000Z")).toBe(
            "2026-03-24",
        );
    });

    it("returns an empty string for empty or invalid values", () => {
        expect(toDateInputValue(null)).toBe("");
        expect(toDateInputValue(undefined)).toBe("");
        expect(toDateInputValue("")).toBe("");
        expect(toDateInputValue("not a date")).toBe("");
    });
});

describe("dueDateHint", () => {
    const now = new Date(2026, 9, 8, 15, 30); // Oct 8, 2026, afternoon

    it("flags overdue dates with the number of days", () => {
        expect(dueDateHint("2026-10-07", false, now)).toEqual({
            text: "Overdue by 1 day",
            tone: "overdue",
        });
        expect(dueDateHint("2026-10-01", false, now)).toEqual({
            text: "Overdue by 7 days",
            tone: "overdue",
        });
    });

    it("flags today and tomorrow as due soon", () => {
        expect(dueDateHint("2026-10-08", false, now)?.text).toBe("Due today");
        expect(dueDateHint("2026-10-09", false, now)?.text).toBe(
            "Due tomorrow",
        );
    });

    it("returns null for later dates, completed tasks and no date", () => {
        expect(dueDateHint("2026-10-12", false, now)).toBeNull();
        expect(dueDateHint("2026-10-01", true, now)).toBeNull();
        expect(dueDateHint("", false, now)).toBeNull();
        expect(dueDateHint(null, false, now)).toBeNull();
    });
});

describe("parseEffortInput", () => {
    it("accepts whole numbers", () => {
        expect(parseEffortInput("8")).toEqual({ text: "8", points: 8 });
        expect(parseEffortInput("13")).toEqual({ text: "13", points: 13 });
    });

    it("strips decimals, signs and exponents", () => {
        expect(parseEffortInput("1.5")).toEqual({ text: "15", points: 15 });
        expect(parseEffortInput("-3")).toEqual({ text: "3", points: 3 });
        expect(parseEffortInput("2e3")).toEqual({ text: "23", points: 23 });
    });

    it("treats an empty field as no estimate", () => {
        expect(parseEffortInput("")).toEqual({ text: "", points: null });
        expect(parseEffortInput("abc")).toEqual({ text: "", points: null });
    });

    it("caps the length", () => {
        expect(parseEffortInput("123456").text).toBe("1234");
    });
});

describe("singleLineTitle", () => {
    it("folds line breaks into single spaces", () => {
        expect(singleLineTitle("Fix\nlogin")).toBe("Fix login");
        expect(singleLineTitle("Fix \r\n  login\n\nnow")).toBe("Fix login now");
    });

    it("leaves single-line titles untouched", () => {
        expect(singleLineTitle("  Spaced title ")).toBe("  Spaced title ");
    });
});
