import {
    createContext,
    useContext,
    useLayoutEffect,
    type PropsWithChildren,
} from "react";
import { createPortal } from "react-dom";

interface LayoutHeaderSlotValue {
    /** DOM node inside the persistent layout's app bar to portal into. */
    container: HTMLElement | null;
    /** Registers a mounted header; returns an unregister callback. */
    registerHeader: () => () => void;
}

const LayoutHeaderSlotContext = createContext<LayoutHeaderSlotValue>({
    container: null,
    registerHeader: () => () => {},
});

/** Used by AuthenticatedLayout to expose its app bar header slot. */
export const LayoutHeaderSlotProvider = LayoutHeaderSlotContext.Provider;

/**
 * Renders its children into the persistent AuthenticatedLayout app bar.
 *
 * Pages keep ownership of their header content (titles, breadcrumbs and
 * interactive actions bound to page state) while the layout itself stays
 * mounted across Inertia navigations — the header is portalled into the
 * layout's app bar instead of being passed as a layout prop, which would
 * otherwise force the layout (and its providers) to remount per page.
 */
export default function LayoutHeader({ children }: PropsWithChildren) {
    const { container, registerHeader } = useContext(LayoutHeaderSlotContext);

    // useLayoutEffect so the layout knows a header exists before paint,
    // avoiding a spacing flash on initial load.
    useLayoutEffect(() => registerHeader(), [registerHeader]);

    if (!container) {
        return null;
    }

    return createPortal(children, container);
}
