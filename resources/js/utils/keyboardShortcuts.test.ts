import { afterEach, describe, expect, it } from "vitest";
import {
    ariaKeyShortcut,
    comboLabels,
    comboText,
    IDLE_SEQUENCE,
    isInteractiveTarget,
    isSingleKeyCombo,
    parseCombo,
    parseStroke,
    readSingleKeyPreference,
    resolveStroke,
    SEQUENCE_TIMEOUT_MS,
    shouldIgnoreTarget,
    SINGLE_KEY_STORAGE_KEY,
    strokeFromEvent,
    strokeMatches,
    writeSingleKeyPreference,
} from "./keyboardShortcuts";

function keyEvent(
    key: string,
    init: Partial<{
        code: string;
        metaKey: boolean;
        ctrlKey: boolean;
        shiftKey: boolean;
        altKey: boolean;
        isComposing: boolean;
    }> = {},
) {
    return {
        key,
        code: init.code ?? "",
        metaKey: init.metaKey ?? false,
        ctrlKey: init.ctrlKey ?? false,
        shiftKey: init.shiftKey ?? false,
        altKey: init.altKey ?? false,
        isComposing: init.isComposing ?? false,
    };
}

describe("parseStroke / parseCombo", () => {
    it("parses modifiers and normalizes key names", () => {
        expect(parseStroke("mod+k")).toEqual({
            key: "k",
            mod: true,
            shift: false,
            alt: false,
        });
        expect(parseStroke("shift+L")).toMatchObject({ key: "l", shift: true });
        expect(parseStroke("Esc").key).toBe("escape");
        expect(parseStroke("alt+arrowdown")).toMatchObject({
            key: "arrowdown",
            alt: true,
        });
        expect(parseStroke("mod+plus").key).toBe("+");
    });

    it("splits sequences on spaces", () => {
        const combo = parseCombo("g d");
        expect(combo.map((s) => s.key)).toEqual(["g", "d"]);
    });

    it("rejects unknown modifiers and empty keys", () => {
        expect(() => parseStroke("hyper+k")).toThrow();
        expect(() => parseStroke("mod+")).toThrow();
    });
});

describe("strokeFromEvent", () => {
    it("maps the platform modifier to mod", () => {
        expect(
            strokeFromEvent(keyEvent("k", { metaKey: true }), true),
        ).toMatchObject({ key: "k", mod: true });
        expect(
            strokeFromEvent(keyEvent("k", { ctrlKey: true }), false),
        ).toMatchObject({ key: "k", mod: true });
    });

    it("drops the other control key, bare modifiers and composition", () => {
        expect(strokeFromEvent(keyEvent("k", { ctrlKey: true }), true)).toBe(
            null,
        );
        expect(strokeFromEvent(keyEvent("k", { metaKey: true }), false)).toBe(
            null,
        );
        expect(
            strokeFromEvent(keyEvent("Shift", { shiftKey: true }), false),
        ).toBe(null);
        expect(
            strokeFromEvent(keyEvent("j", { isComposing: true }), false),
        ).toBe(null);
        expect(strokeFromEvent(keyEvent(""), false)).toBe(null);
    });

    it("lowercases letters and keeps shift", () => {
        expect(
            strokeFromEvent(keyEvent("L", { shiftKey: true }), false),
        ).toEqual({ key: "l", mod: false, shift: true, alt: false });
    });

    it("falls back to the physical key only for non-Latin layouts", () => {
        // Cyrillic layout: the K key types "л".
        expect(
            strokeFromEvent(keyEvent("л", { code: "KeyK" }), false)?.key,
        ).toBe("k");
        // Dvorak: the physical K key types "t" — that's a "t".
        expect(
            strokeFromEvent(keyEvent("t", { code: "KeyK" }), false)?.key,
        ).toBe("t");
    });
});

describe("strokeMatches", () => {
    const actual = (key: string, init = {}) =>
        strokeFromEvent(keyEvent(key, init), false)!;

    it("requires shift to match for letters and named keys", () => {
        expect(strokeMatches(parseStroke("l"), actual("l"))).toBe(true);
        expect(
            strokeMatches(parseStroke("l"), actual("L", { shiftKey: true })),
        ).toBe(false);
        expect(
            strokeMatches(
                parseStroke("shift+l"),
                actual("L", { shiftKey: true }),
            ),
        ).toBe(true);
        expect(
            strokeMatches(
                parseStroke("enter"),
                actual("Enter", { shiftKey: true }),
            ),
        ).toBe(false);
    });

    it("ignores shift for punctuation and digits", () => {
        expect(
            strokeMatches(parseStroke("?"), actual("?", { shiftKey: true })),
        ).toBe(true);
        expect(strokeMatches(parseStroke("?"), actual("?"))).toBe(true);
        expect(strokeMatches(parseStroke("["), actual("["))).toBe(true);
    });

    it("requires modifiers to match exactly", () => {
        expect(
            strokeMatches(parseStroke("k"), actual("k", { ctrlKey: true })),
        ).toBe(false);
        expect(
            strokeMatches(parseStroke("mod+k"), actual("k", { ctrlKey: true })),
        ).toBe(true);
        expect(
            strokeMatches(parseStroke("k"), actual("k", { altKey: true })),
        ).toBe(false);
    });
});

describe("resolveStroke", () => {
    const candidates = [
        { id: "dashboard", combos: [parseCombo("g d")] },
        { id: "notifications", combos: [parseCombo("g n")] },
        { id: "down", combos: [parseCombo("j"), parseCombo("arrowdown")] },
        { id: "down-too", combos: [parseCombo("j")] },
    ];
    const stroke = (key: string) => parseStroke(key);

    it("fires single-stroke shortcuts, reporting every match", () => {
        const result = resolveStroke(IDLE_SEQUENCE, stroke("j"), candidates, 0);
        expect(result.matches).toEqual(["down", "down-too"]);
        expect(result.next).toEqual(IDLE_SEQUENCE);
    });

    it("completes a two-key sequence", () => {
        const first = resolveStroke(
            IDLE_SEQUENCE,
            stroke("g"),
            candidates,
            100,
        );
        expect(first.matches).toEqual([]);
        expect(first.startedSequence).toBe(true);
        expect(first.next.pending?.key).toBe("g");

        const second = resolveStroke(first.next, stroke("n"), candidates, 400);
        expect(second.matches).toEqual(["notifications"]);
        expect(second.next).toEqual(IDLE_SEQUENCE);
    });

    it("expires a pending prefix after the timeout", () => {
        const first = resolveStroke(IDLE_SEQUENCE, stroke("g"), candidates, 0);
        const late = resolveStroke(
            first.next,
            stroke("d"),
            candidates,
            SEQUENCE_TIMEOUT_MS + 1,
        );
        expect(late.matches).toEqual([]);
    });

    it("treats a non-completing second key on its own", () => {
        const first = resolveStroke(IDLE_SEQUENCE, stroke("g"), candidates, 0);
        const result = resolveStroke(first.next, stroke("j"), candidates, 10);
        expect(result.matches).toEqual(["down", "down-too"]);
        expect(result.next).toEqual(IDLE_SEQUENCE);
    });

    it("ignores unrelated keys", () => {
        const result = resolveStroke(IDLE_SEQUENCE, stroke("q"), candidates, 0);
        expect(result).toEqual({
            matches: [],
            next: IDLE_SEQUENCE,
            startedSequence: false,
        });
    });
});

describe("shouldIgnoreTarget", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    function make(html: string, selector: string): Element {
        document.body.innerHTML = html;
        return document.querySelector(selector)!;
    }

    it("ignores typing targets unless allowed", () => {
        for (const [html, selector] of [
            ["<input />", "input"],
            ["<textarea></textarea>", "textarea"],
            ["<select><option>a</option></select>", "select"],
            ['<div contenteditable="true"><p>hi</p></div>', "p"],
        ]) {
            const el = make(html, selector);
            expect(shouldIgnoreTarget(el)).toBe(true);
            expect(shouldIgnoreTarget(el, { allowInInputs: true })).toBe(false);
        }
    });

    it("does not treat contenteditable=false as typing", () => {
        const el = make(
            '<div contenteditable="false"><span>x</span></div>',
            "span",
        );
        expect(shouldIgnoreTarget(el)).toBe(false);
    });

    it("ignores focus inside dialogs, menus and popovers unless allowed", () => {
        for (const html of [
            '<div role="dialog"><button>x</button></div>',
            '<ul role="menu"><li><button>x</button></li></ul>',
            '<div class="MuiPopover-root"><button>x</button></div>',
        ]) {
            const el = make(html, "button");
            expect(shouldIgnoreTarget(el)).toBe(true);
            expect(shouldIgnoreTarget(el, { allowInPopups: true })).toBe(false);
        }
    });

    it("lets plain page targets through", () => {
        expect(shouldIgnoreTarget(document.body)).toBe(false);
        expect(shouldIgnoreTarget(make("<button>x</button>", "button"))).toBe(
            false,
        );
        expect(shouldIgnoreTarget(null)).toBe(false);
    });

    it("recognises interactive targets", () => {
        expect(isInteractiveTarget(make('<a href="/x">x</a>', "a"))).toBe(true);
        expect(
            isInteractiveTarget(
                make("<button><span>x</span></button>", "span"),
            ),
        ).toBe(true);
        expect(isInteractiveTarget(document.body)).toBe(false);
    });
});

describe("labels", () => {
    it("uses Mac symbols on Apple platforms", () => {
        expect(comboLabels("mod+k", true)).toEqual([["⌘", "K"]]);
        expect(comboLabels("shift+l", true)).toEqual([["⇧", "L"]]);
        expect(comboLabels("mod+enter", true)).toEqual([["⌘", "↩"]]);
        expect(comboText("mod+k", true)).toBe("⌘K");
    });

    it("uses words elsewhere", () => {
        expect(comboLabels("mod+k", false)).toEqual([["Ctrl", "K"]]);
        expect(comboLabels("shift+l", false)).toEqual([["Shift", "L"]]);
        expect(comboText("mod+shift+k", false)).toBe("Ctrl+Shift+K");
        expect(comboText("alt+k", false)).toBe("Alt+K");
    });

    it("keeps bare letters lowercase and drops implied shift", () => {
        expect(comboLabels("j", false)).toEqual([["j"]]);
        expect(comboLabels("?", true)).toEqual([["?"]]);
        expect(comboLabels("escape", false)).toEqual([["Esc"]]);
        expect(comboLabels("arrowdown", false)).toEqual([["↓"]]);
    });

    it("describes sequences", () => {
        expect(comboLabels("g d", false)).toEqual([["g"], ["d"]]);
        expect(comboText("g s", true)).toBe("g then s");
    });

    it("builds aria-keyshortcuts values", () => {
        expect(ariaKeyShortcut("mod+k", true)).toBe("Meta+K");
        expect(ariaKeyShortcut("mod+k", false)).toBe("Control+K");
        expect(ariaKeyShortcut("shift+h", false)).toBe("Shift+H");
        expect(ariaKeyShortcut("escape", false)).toBe("Escape");
        expect(ariaKeyShortcut("g d", false)).toBeUndefined();
    });
});

describe("isSingleKeyCombo", () => {
    it("is true without mod/alt (shift is still single-key)", () => {
        expect(isSingleKeyCombo(parseCombo("j"))).toBe(true);
        expect(isSingleKeyCombo(parseCombo("shift+l"))).toBe(true);
        expect(isSingleKeyCombo(parseCombo("g d"))).toBe(true);
        expect(isSingleKeyCombo(parseCombo("mod+k"))).toBe(false);
        expect(isSingleKeyCombo(parseCombo("alt+j"))).toBe(false);
    });
});

describe("single-key preference", () => {
    function storage(initial: Record<string, string> = {}) {
        const map = new Map(Object.entries(initial));
        return {
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => void map.set(k, v),
            removeItem: (k: string) => void map.delete(k),
            map,
        };
    }

    it("defaults to on and round-trips", () => {
        const s = storage();
        expect(readSingleKeyPreference(s)).toBe(true);
        writeSingleKeyPreference(false, s);
        expect(s.map.get(SINGLE_KEY_STORAGE_KEY)).toBe("off");
        expect(readSingleKeyPreference(s)).toBe(false);
        writeSingleKeyPreference(true, s);
        expect(s.map.has(SINGLE_KEY_STORAGE_KEY)).toBe(false);
    });

    it("survives storage that throws", () => {
        const broken = {
            getItem: () => {
                throw new Error("denied");
            },
            setItem: () => {
                throw new Error("denied");
            },
            removeItem: () => {
                throw new Error("denied");
            },
        };
        expect(readSingleKeyPreference(broken)).toBe(true);
        expect(() => writeSingleKeyPreference(false, broken)).not.toThrow();
    });
});
