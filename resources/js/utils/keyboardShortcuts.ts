/**
 * Pure helpers behind the keyboard shortcut registry: parsing shortcut specs
 * ("mod+k", "shift+l", "g d"), turning keyboard events into comparable
 * strokes, resolving two-key sequences, deciding when to stay out of the
 * user's way, and platform-correct key labels for the help overlay.
 *
 * Spec syntax:
 *   - One stroke is `[modifier+]*key`, modifiers `mod` (⌘ on Apple, Ctrl
 *     elsewhere), `shift`, `alt`. Keys are a single character ("k", "?",
 *     "[", "1") or a named key ("enter", "escape", "arrowdown", "space").
 *   - A sequence is strokes separated by a space: "g d".
 *   - Letters and named keys match Shift exactly ("l" ≠ "shift+l");
 *     punctuation and digits ignore Shift, because layouts differ on which
 *     characters need it ("?" is Shift+/ on US, but not everywhere).
 */
import { isApplePlatform, isEditableTarget } from "@/utils/quickSwitcher";

export { isApplePlatform, isEditableTarget };

export interface Stroke {
    /** Lowercase character ("k", "?") or lowercase named key ("enter"). */
    key: string;
    mod: boolean;
    shift: boolean;
    alt: boolean;
}

export type Combo = Stroke[];

/** Max time between the two keys of a sequence like "g d". */
export const SEQUENCE_TIMEOUT_MS = 1200;

const KEY_ALIASES: Record<string, string> = {
    esc: "escape",
    return: "enter",
    up: "arrowup",
    down: "arrowdown",
    left: "arrowleft",
    right: "arrowright",
    " ": "space",
    spacebar: "space",
    del: "delete",
};

const MODIFIER_KEYS = new Set([
    "shift",
    "control",
    "meta",
    "alt",
    "altgraph",
    "os",
    "capslock",
    "fn",
    "hyper",
    "super",
]);

function normalizeKeyName(key: string): string {
    const lower = key.toLowerCase();
    return KEY_ALIASES[lower] ?? lower;
}

function isLetter(key: string): boolean {
    return /^[a-z]$/.test(key);
}

/** Single characters other than letters: Shift is ignored when matching. */
function isShiftAgnostic(key: string): boolean {
    return key.length === 1 && !isLetter(key);
}

/** Parse one stroke, e.g. "mod+shift+k". Throws on an empty key. */
export function parseStroke(spec: string): Stroke {
    // "mod++" would be ambiguous; "+" itself is written "plus".
    const parts = spec.trim().split("+");
    const rawKey = parts.pop() ?? "";
    const stroke: Stroke = { key: "", mod: false, shift: false, alt: false };

    for (const part of parts) {
        const modifier = part.trim().toLowerCase();
        if (modifier === "mod") {
            stroke.mod = true;
        } else if (modifier === "shift") {
            stroke.shift = true;
        } else if (modifier === "alt" || modifier === "option") {
            stroke.alt = true;
        } else if (modifier) {
            throw new Error(`Unknown modifier "${part}" in "${spec}"`);
        }
    }

    const key = rawKey === "plus" ? "+" : normalizeKeyName(rawKey);
    if (!key) throw new Error(`Missing key in shortcut "${spec}"`);
    stroke.key = key;
    return stroke;
}

/** Parse a full spec: one stroke, or a space-separated sequence. */
export function parseCombo(spec: string): Combo {
    const trimmed = spec.trim();
    // A lone space key is written "space", so splitting on spaces is safe.
    return trimmed.split(/\s+/).map(parseStroke);
}

/**
 * The stroke a keydown produced, or null for events no shortcut should see
 * (bare modifier presses, IME composition, autofill's key-less events, and
 * the "other" control key — Ctrl on a Mac, Meta/Windows elsewhere).
 */
export function strokeFromEvent(
    event: Pick<
        KeyboardEvent,
        | "key"
        | "code"
        | "metaKey"
        | "ctrlKey"
        | "shiftKey"
        | "altKey"
        | "isComposing"
    >,
    apple: boolean,
): Stroke | null {
    if (event.isComposing || typeof event.key !== "string" || !event.key) {
        return null;
    }
    let key = normalizeKeyName(event.key);
    if (MODIFIER_KEYS.has(key) || key === "dead" || key === "unidentified") {
        return null;
    }

    const otherControl = apple ? event.ctrlKey : event.metaKey;
    if (otherControl) return null;

    // Match the produced character; fall back to the physical key only for
    // non-Latin layouts (so Dvorak's physical K, which types "t", doesn't
    // trigger "k").
    if (
        key.length === 1 &&
        !/^[\x20-\x7e]$/.test(key) &&
        typeof event.code === "string"
    ) {
        const physical = /^Key([A-Z])$/.exec(event.code);
        if (physical) key = physical[1].toLowerCase();
    }

    return {
        key,
        mod: apple ? event.metaKey : event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
    };
}

export function strokeMatches(expected: Stroke, actual: Stroke): boolean {
    if (expected.key !== actual.key) return false;
    if (expected.mod !== actual.mod || expected.alt !== actual.alt) {
        return false;
    }
    return isShiftAgnostic(expected.key) || expected.shift === actual.shift;
}

/** True when no stroke uses mod/alt — the kind users can switch off. */
export function isSingleKeyCombo(combo: Combo): boolean {
    return combo.every((stroke) => !stroke.mod && !stroke.alt);
}

export interface SequenceState {
    /** First stroke of a sequence in progress, if any. */
    pending: Stroke | null;
    /** When `pending` was pressed (ms). */
    at: number;
}

export const IDLE_SEQUENCE: SequenceState = { pending: null, at: 0 };

export interface ResolveCandidate<Id> {
    id: Id;
    combos: Combo[];
}

export interface ResolveResult<Id> {
    /** Shortcut ids that match, best first (caller applies priority). */
    matches: Id[];
    /** Sequence state after this stroke. */
    next: SequenceState;
    /** The stroke started a sequence (callers may swallow it). */
    startedSequence: boolean;
}

/**
 * Resolve a stroke against candidate shortcuts, tracking two-key sequences.
 *
 * A pending first stroke is tried first ("g" then "d"); if nothing completes
 * the sequence, the stroke is considered on its own. A stroke that matches
 * a single-stroke shortcut fires it; otherwise, if it begins any sequence,
 * it becomes the pending stroke.
 */
export function resolveStroke<Id>(
    state: SequenceState,
    stroke: Stroke,
    candidates: readonly ResolveCandidate<Id>[],
    now: number,
    timeout = SEQUENCE_TIMEOUT_MS,
): ResolveResult<Id> {
    const pending =
        state.pending && now - state.at <= timeout ? state.pending : null;

    if (pending) {
        const completed = candidates
            .filter((c) =>
                c.combos.some(
                    (combo) =>
                        combo.length === 2 &&
                        strokeMatches(combo[0], pending) &&
                        strokeMatches(combo[1], stroke),
                ),
            )
            .map((c) => c.id);
        if (completed.length > 0) {
            return {
                matches: completed,
                next: IDLE_SEQUENCE,
                startedSequence: false,
            };
        }
    }

    const single = candidates
        .filter((c) =>
            c.combos.some(
                (combo) =>
                    combo.length === 1 && strokeMatches(combo[0], stroke),
            ),
        )
        .map((c) => c.id);
    if (single.length > 0) {
        return { matches: single, next: IDLE_SEQUENCE, startedSequence: false };
    }

    const startsSequence = candidates.some((c) =>
        c.combos.some(
            (combo) => combo.length > 1 && strokeMatches(combo[0], stroke),
        ),
    );
    if (startsSequence) {
        return {
            matches: [],
            next: { pending: stroke, at: now },
            startedSequence: true,
        };
    }

    return { matches: [], next: IDLE_SEQUENCE, startedSequence: false };
}

/**
 * Focus inside these means a popup (dialog, menu, listbox, popover) owns
 * the keyboard; only shortcuts that opt in may fire there.
 */
export const POPUP_SELECTOR = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="menu"]',
    '[role="listbox"]',
    ".MuiPopover-root",
    ".MuiModal-root",
].join(", ");

export function isInPopup(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(POPUP_SELECTOR) !== null;
}

/**
 * Elements whose own Enter/Space behaviour must win (activating a button,
 * following a link, toggling a checkbox).
 */
const INTERACTIVE_SELECTOR =
    'a[href], button, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [role="option"], [role="menuitem"]';

export function isInteractiveTarget(target: EventTarget | null): boolean {
    return (
        target instanceof Element &&
        target.closest(INTERACTIVE_SELECTOR) !== null
    );
}

export interface IgnoreOptions {
    /** Fire even while typing in a field or editor (e.g. Esc, ⌘Enter). */
    allowInInputs?: boolean;
    /** Fire even while a dialog, menu or popover holds focus. */
    allowInPopups?: boolean;
}

/** Whether a shortcut must stay quiet for an event with this target. */
export function shouldIgnoreTarget(
    target: EventTarget | null,
    options: IgnoreOptions = {},
): boolean {
    if (!options.allowInInputs && isEditableTarget(target)) return true;
    if (!options.allowInPopups && isInPopup(target)) return true;
    return false;
}

// ── Labels ──────────────────────────────────────────────────────────────

const NAMED_LABELS: Record<string, { apple: string; other: string }> = {
    enter: { apple: "↩", other: "Enter" },
    escape: { apple: "Esc", other: "Esc" },
    arrowup: { apple: "↑", other: "↑" },
    arrowdown: { apple: "↓", other: "↓" },
    arrowleft: { apple: "←", other: "←" },
    arrowright: { apple: "→", other: "→" },
    space: { apple: "Space", other: "Space" },
    tab: { apple: "Tab", other: "Tab" },
    backspace: { apple: "⌫", other: "Backspace" },
    delete: { apple: "⌦", other: "Delete" },
};

function keyLabel(stroke: Stroke, apple: boolean): string {
    const named = NAMED_LABELS[stroke.key];
    if (named) return apple ? named.apple : named.other;
    if (isLetter(stroke.key)) {
        // Bare letters read as typed ("j"); with a modifier, as on the keycap.
        return stroke.mod || stroke.shift || stroke.alt
            ? stroke.key.toUpperCase()
            : stroke.key;
    }
    return stroke.key;
}

/** Key caps for one stroke, e.g. ["⌘", "K"] or ["Ctrl", "K"]. */
export function strokeLabels(stroke: Stroke, apple: boolean): string[] {
    const caps: string[] = [];
    if (stroke.mod) caps.push(apple ? "⌘" : "Ctrl");
    if (stroke.alt) caps.push(apple ? "⌥" : "Alt");
    if (stroke.shift && !isShiftAgnostic(stroke.key)) {
        caps.push(apple ? "⇧" : "Shift");
    }
    caps.push(keyLabel(stroke, apple));
    return caps;
}

/** Key caps per stroke: "g d" → [["g"], ["d"]]. */
export function comboLabels(spec: string, apple: boolean): string[][] {
    return parseCombo(spec).map((stroke) => strokeLabels(stroke, apple));
}

/**
 * Compact text form for tooltips and titles: "⌘K", "Ctrl+K", "⇧L",
 * "Shift+L", "g then d".
 */
export function comboText(spec: string, apple: boolean): string {
    return comboLabels(spec, apple)
        .map((caps) => caps.join(apple ? "" : "+"))
        .join(" then ");
}

const ARIA_KEY_NAMES: Record<string, string> = {
    enter: "Enter",
    escape: "Escape",
    arrowup: "ArrowUp",
    arrowdown: "ArrowDown",
    arrowleft: "ArrowLeft",
    arrowright: "ArrowRight",
    space: "Space",
    tab: "Tab",
    backspace: "Backspace",
    delete: "Delete",
};

/**
 * Value for `aria-keyshortcuts` ("Control+K", "Meta+K", "Shift+L"), or
 * undefined for sequences, which the attribute cannot express.
 */
export function ariaKeyShortcut(
    spec: string,
    apple: boolean,
): string | undefined {
    const combo = parseCombo(spec);
    if (combo.length !== 1) return undefined;
    const [stroke] = combo;
    const parts: string[] = [];
    if (stroke.mod) parts.push(apple ? "Meta" : "Control");
    if (stroke.alt) parts.push("Alt");
    if (stroke.shift && !isShiftAgnostic(stroke.key)) parts.push("Shift");
    parts.push(
        ARIA_KEY_NAMES[stroke.key] ??
            (isLetter(stroke.key) ? stroke.key.toUpperCase() : stroke.key),
    );
    return parts.join("+");
}

// ── Preference ──────────────────────────────────────────────────────────

export const SINGLE_KEY_STORAGE_KEY = "pulseboard:shortcuts:single-key";

/** Single-key shortcuts are on unless this browser turned them off. */
export function readSingleKeyPreference(
    storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage(),
): boolean {
    try {
        return storage?.getItem(SINGLE_KEY_STORAGE_KEY) !== "off";
    } catch {
        return true;
    }
}

export function writeSingleKeyPreference(
    enabled: boolean,
    storage:
        | Pick<Storage, "setItem" | "removeItem">
        | undefined = safeLocalStorage(),
): void {
    try {
        if (enabled) storage?.removeItem(SINGLE_KEY_STORAGE_KEY);
        else storage?.setItem(SINGLE_KEY_STORAGE_KEY, "off");
    } catch {
        // Storage blocked (private mode, quota): the choice lasts this visit.
    }
}

function safeLocalStorage(): Storage | undefined {
    try {
        return typeof localStorage === "undefined" ? undefined : localStorage;
    } catch {
        return undefined;
    }
}
