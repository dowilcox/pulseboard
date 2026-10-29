import KeyboardShortcutsDialog from "@/Components/Layout/KeyboardShortcutsDialog";
import {
    type Combo,
    IDLE_SEQUENCE,
    isApplePlatform,
    isInteractiveTarget,
    isSingleKeyCombo,
    parseCombo,
    readSingleKeyPreference,
    resolveStroke,
    type SequenceState,
    shouldIgnoreTarget,
    strokeFromEvent,
    comboText,
    writeSingleKeyPreference,
} from "@/utils/keyboardShortcuts";
import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

/**
 * Where a shortcut applies. When several active shortcuts share a key, the
 * innermost scope wins (task > board > global), then the most recently
 * registered.
 */
export type ShortcutScope = "global" | "board" | "task";

export const SCOPE_ORDER: readonly ShortcutScope[] = [
    "global",
    "board",
    "task",
];

export const SCOPE_LABELS: Record<ShortcutScope, string> = {
    global: "Everywhere",
    board: "Board",
    task: "Open task",
};

export interface ShortcutDefinition {
    /** Stable id, unique within the registering component. */
    id: string;
    /** One spec or alternatives, e.g. "mod+k", ["j", "arrowdown"], "g d". */
    keys: string | readonly string[];
    /** Shown in the help overlay. */
    description: string;
    scope?: ShortcutScope;
    /** Sub-heading in the help overlay ("Navigate", "Move", …). */
    group?: string;
    /**
     * Runs on a match. Return `false` to decline (the next match, in an
     * outer scope, gets a turn, and the event is left alone).
     */
    handler: (event: KeyboardEvent) => void | boolean;
    /** Temporarily inactive (still not listed in the help overlay). */
    enabled?: boolean;
    /** Active but not listed in the help overlay. */
    hidden?: boolean;
    /** Fire while typing in a field or editor. Default false. */
    allowInInputs?: boolean;
    /** Fire while a dialog, menu or popover holds focus. Default false. */
    allowInPopups?: boolean;
    /**
     * Leave Enter/Space alone when focus is on a button or link, whose own
     * activation (Enter follows a link) must win. Other keys of the same
     * shortcut still work. Default false.
     */
    skipOnInteractive?: boolean;
    /** Keeps working when single-key shortcuts are turned off (Esc). */
    essential?: boolean;
    /** Default true. */
    preventDefault?: boolean;
}

export interface RegisteredShortcut {
    token: number;
    id: string;
    keys: readonly string[];
    combos: Combo[];
    description: string;
    scope: ShortcutScope;
    group?: string;
    hidden: boolean;
    enabled: boolean;
    allowInInputs: boolean;
    allowInPopups: boolean;
    skipOnInteractive: boolean;
    essential: boolean;
    preventDefault: boolean;
    run: (event: KeyboardEvent) => void | boolean;
}

/** Mutable list of active shortcuts with change subscription. */
export class ShortcutRegistry {
    private entries: RegisteredShortcut[] = [];
    private listeners = new Set<() => void>();
    private nextToken = 1;

    register(entry: Omit<RegisteredShortcut, "token">): () => void {
        const token = this.nextToken++;
        this.entries = [...this.entries, { ...entry, token }];
        this.emit();
        return () => {
            this.entries = this.entries.filter((e) => e.token !== token);
            this.emit();
        };
    }

    list = (): readonly RegisteredShortcut[] => this.entries;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    private emit() {
        for (const listener of this.listeners) listener();
    }
}

const SCOPE_RANK: Record<ShortcutScope, number> = {
    global: 0,
    board: 1,
    task: 2,
};

/** Innermost scope first, then the most recently registered. */
export function byPriority(
    a: Pick<RegisteredShortcut, "scope" | "token">,
    b: Pick<RegisteredShortcut, "scope" | "token">,
): number {
    return SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope] || b.token - a.token;
}

interface KeyboardShortcutsValue {
    apple: boolean;
    singleKeyEnabled: boolean;
    setSingleKeyEnabled: (enabled: boolean) => void;
    helpOpen: boolean;
    openHelp: () => void;
    closeHelp: () => void;
}

const RegistryContext = createContext<ShortcutRegistry | null>(null);

const FALLBACK: KeyboardShortcutsValue = {
    apple: isApplePlatform(),
    singleKeyEnabled: true,
    setSingleKeyEnabled: () => {},
    helpOpen: false,
    openHelp: () => {},
    closeHelp: () => {},
};

const KeyboardShortcutsContext =
    createContext<KeyboardShortcutsValue>(FALLBACK);

export function useKeyboardShortcuts(): KeyboardShortcutsValue {
    return useContext(KeyboardShortcutsContext);
}

/** Every registered shortcut, re-rendering when the set changes. */
export function useRegisteredShortcuts(): readonly RegisteredShortcut[] {
    const registry = useContext(RegistryContext);
    return useSyncExternalStore(
        registry?.subscribe ?? noopSubscribe,
        registry?.list ?? emptyList,
        registry?.list ?? emptyList,
    );
}

const EMPTY: readonly RegisteredShortcut[] = [];
const emptyList = () => EMPTY;
const noopSubscribe = () => () => {};

/**
 * Register shortcuts for as long as the calling component is mounted.
 * Handlers may change every render; the registration only changes when a
 * shortcut's keys, scope, description or flags do. Outside a
 * KeyboardShortcutsProvider (e.g. unit tests) this does nothing.
 */
export function useShortcuts(definitions: readonly ShortcutDefinition[]) {
    const registry = useContext(RegistryContext);
    const definitionsRef = useRef(definitions);

    useEffect(() => {
        definitionsRef.current = definitions;
    });

    const signature = definitions
        .map((d) =>
            [
                d.id,
                ([] as string[]).concat(d.keys).join(","),
                d.scope ?? "global",
                d.group ?? "",
                d.description,
                d.enabled === false ? 0 : 1,
                d.hidden ? 1 : 0,
                d.allowInInputs ? 1 : 0,
                d.allowInPopups ? 1 : 0,
                d.skipOnInteractive ? 1 : 0,
                d.essential ? 1 : 0,
                d.preventDefault === false ? 0 : 1,
            ].join("\u0001"),
        )
        .join("\u0002");

    useEffect(() => {
        if (!registry) return;
        const unregister = definitionsRef.current.map((d) => {
            const keys = ([] as string[]).concat(d.keys);
            return registry.register({
                id: d.id,
                keys,
                combos: keys.map(parseCombo),
                description: d.description,
                scope: d.scope ?? "global",
                group: d.group,
                hidden: d.hidden ?? false,
                enabled: d.enabled !== false,
                allowInInputs: d.allowInInputs ?? false,
                allowInPopups: d.allowInPopups ?? false,
                skipOnInteractive: d.skipOnInteractive ?? false,
                essential: d.essential ?? false,
                preventDefault: d.preventDefault !== false,
                run: (event) =>
                    definitionsRef.current
                        .find((current) => current.id === d.id)
                        ?.handler(event),
            });
        });
        return () => unregister.forEach((fn) => fn());
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by signature
    }, [registry, signature]);
}

/** Convenience for one shortcut. */
export function useShortcut(definition: ShortcutDefinition) {
    useShortcuts([definition]);
}

/**
 * Text hint for a tooltip or title ("c", "⌘K", "g then s"), or "" when the
 * shortcut is single-key and the user switched those off.
 */
export function useShortcutHint(spec: string): string {
    const { apple, singleKeyEnabled } = useKeyboardShortcuts();
    return useMemo(() => {
        if (!singleKeyEnabled && isSingleKeyCombo(parseCombo(spec))) return "";
        return comboText(spec, apple);
    }, [spec, apple, singleKeyEnabled]);
}

/** Keys that activate a focused button or link natively. */
const ACTIVATION_KEYS = new Set(["enter", "space"]);

/** Pick the shortcuts allowed to see this event (pure, exported for tests). */
export function eligibleShortcuts(
    entries: readonly RegisteredShortcut[],
    target: EventTarget | null,
    singleKeyEnabled: boolean,
): { entry: RegisteredShortcut; combos: Combo[] }[] {
    const interactive = isInteractiveTarget(target);
    const result: { entry: RegisteredShortcut; combos: Combo[] }[] = [];
    for (const entry of entries) {
        if (!entry.enabled) continue;
        if (shouldIgnoreTarget(target, entry)) continue;
        const combos = entry.combos.filter(
            (combo) =>
                (singleKeyEnabled ||
                    entry.essential ||
                    !isSingleKeyCombo(combo)) &&
                !(
                    entry.skipOnInteractive &&
                    interactive &&
                    ACTIVATION_KEYS.has(combo[0].key)
                ),
        );
        if (combos.length > 0) result.push({ entry, combos });
    }
    return result;
}

/**
 * App-wide keyboard shortcut registry: one keydown listener resolves keys,
 * sequences and scopes for every `useShortcuts` caller, and owns the "?"
 * help overlay and the single-key preference. Mount once, in the
 * persistent layout.
 */
export function KeyboardShortcutsProvider({ children }: PropsWithChildren) {
    const [registry] = useState(() => new ShortcutRegistry());
    const apple = useMemo(() => isApplePlatform(), []);
    const [singleKeyEnabled, setSingleKeyState] = useState(() =>
        readSingleKeyPreference(),
    );
    const [helpOpen, setHelpOpen] = useState(false);
    const sequenceRef = useRef<SequenceState>(IDLE_SEQUENCE);
    const singleKeyRef = useRef(singleKeyEnabled);
    singleKeyRef.current = singleKeyEnabled;

    const setSingleKeyEnabled = useCallback((enabled: boolean) => {
        setSingleKeyState(enabled);
        writeSingleKeyPreference(enabled);
    }, []);
    const openHelp = useCallback(() => setHelpOpen(true), []);
    const closeHelp = useCallback(() => setHelpOpen(false), []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // A component handled the key itself (Esc in a form, dnd-kit).
            if (event.defaultPrevented) return;
            const stroke = strokeFromEvent(event, apple);
            if (!stroke) return;

            const eligible = eligibleShortcuts(
                registry.list(),
                event.target,
                singleKeyRef.current,
            );
            const result = resolveStroke(
                sequenceRef.current,
                stroke,
                eligible.map(({ entry, combos }) => ({ id: entry, combos })),
                Date.now(),
            );
            sequenceRef.current = result.next;

            const matches = [...result.matches].sort(byPriority);
            for (const entry of matches) {
                if (entry.run(event) === false) continue;
                if (entry.preventDefault) event.preventDefault();
                return;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [registry, apple]);

    const value = useMemo(
        () => ({
            apple,
            singleKeyEnabled,
            setSingleKeyEnabled,
            helpOpen,
            openHelp,
            closeHelp,
        }),
        [
            apple,
            singleKeyEnabled,
            setSingleKeyEnabled,
            helpOpen,
            openHelp,
            closeHelp,
        ],
    );

    return (
        <RegistryContext.Provider value={registry}>
            <KeyboardShortcutsContext.Provider value={value}>
                {children}
                <HelpShortcuts helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
                <KeyboardShortcutsDialog open={helpOpen} onClose={closeHelp} />
            </KeyboardShortcutsContext.Provider>
        </RegistryContext.Provider>
    );
}

function HelpShortcuts({
    helpOpen,
    setHelpOpen,
}: {
    helpOpen: boolean;
    setHelpOpen: (update: (open: boolean) => boolean) => void;
}) {
    useShortcuts([
        {
            id: "help",
            keys: ["?", "mod+/"],
            description: "Show keyboard shortcuts",
            // From inside the overlay (even on its toggle), "?" closes it.
            allowInPopups: helpOpen,
            allowInInputs: helpOpen,
            handler: () => setHelpOpen((open) => !open),
        },
    ]);
    return null;
}
