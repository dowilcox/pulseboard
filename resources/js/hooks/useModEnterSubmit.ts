import { useKeyboardShortcuts } from "@/Contexts/KeyboardShortcutsContext";
import type { KeyboardEvent } from "react";

/**
 * ⌘Enter / Ctrl+Enter submits a rich-text form. Use the returned handler
 * as `onKeyDownCapture` on the editor's wrapper: the capture phase runs
 * before TipTap, whose own Mod-Enter would otherwise insert a line break.
 */
export function useModEnterSubmit(submit: () => void) {
    const { apple } = useKeyboardShortcuts();

    return (event: KeyboardEvent) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        const mod = apple ? event.metaKey : event.ctrlKey;
        if (!mod || event.shiftKey || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        submit();
    };
}
