import { router } from "@inertiajs/react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import { harbor, harborHex } from "@/theme/harbor";
import {
    isApplePlatform,
    isEditableTarget,
    shortcutHint,
} from "@/utils/quickSwitcher";
import QuickSwitcherPanel from "./QuickSwitcherPanel";

/** Focus inside these means another popup owns single-key input. */
const POPUP_SELECTOR = '[role="dialog"], [role="menu"], [role="listbox"]';

/**
 * Global quick switcher: jump to any board, team, page or task.
 *
 * Renders its own trigger (a search-field-styled button on md+, an icon
 * button on xs) and owns the shortcuts: Cmd/Ctrl+K toggles it from anywhere,
 * "/" opens it when focus is not in a text field or editor. Mount it once,
 * in the persistent layout's app bar.
 */
export default function QuickSwitcher() {
    const [open, setOpen] = useState(false);
    const titleId = useId();
    const apple = useMemo(() => isApplePlatform(), []);
    const hint = shortcutHint(apple);
    const keyShortcuts = `${apple ? "Meta" : "Control"}+K /`;

    const openSwitcher = useCallback(() => setOpen(true), []);
    const closeSwitcher = useCallback(() => setOpen(false), []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Chrome autofill dispatches keydown events without a key.
            if (event.isComposing || typeof event.key !== "string") return;

            const modifier = apple ? event.metaKey : event.ctrlKey;
            const key = event.key.toLowerCase();
            // Match the produced "k"; fall back to the physical key only for
            // non-Latin layouts (so Dvorak's physical K, which types "t",
            // doesn't hijack Cmd/Ctrl+T).
            const isK =
                key === "k" || (!/^[a-z]$/.test(key) && event.code === "KeyK");
            if (modifier && !event.altKey && !event.shiftKey && isK) {
                event.preventDefault();
                setOpen((isOpen) => !isOpen);
                return;
            }

            if (
                event.key === "/" &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.defaultPrevented &&
                !isEditableTarget(event.target) &&
                !(
                    event.target instanceof Element &&
                    event.target.closest(POPUP_SELECTOR)
                )
            ) {
                event.preventDefault();
                setOpen(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [apple]);

    // The layout persists across visits, so close on any navigation
    // (including back/forward) rather than relying on a remount.
    useEffect(() => router.on("navigate", () => setOpen(false)), []);

    return (
        <>
            <ButtonBase
                onClick={openSwitcher}
                aria-haspopup="dialog"
                aria-keyshortcuts={keyShortcuts}
                sx={{
                    display: { xs: "none", md: "flex" },
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: 1,
                    width: { md: 200, lg: 260 },
                    height: 34,
                    pl: 1.25,
                    pr: 0.75,
                    bgcolor: harbor.card,
                    border: `1px solid ${harborHex.inputBorder}`,
                    borderRadius: `${harbor.radius.control}px`,
                    color: harbor.sub,
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    transition: "border-color 120ms ease",
                    "&:hover": { borderColor: harbor.ink },
                }}
            >
                <SearchIcon aria-hidden sx={{ fontSize: 18 }} />
                <Box component="span" sx={{ flexGrow: 1, textAlign: "left" }}>
                    Search…
                </Box>
                {/* Separates the label from the hint in the accessible name;
                    flex layout ignores the whitespace visually. */}{" "}
                {/* Not aria-hidden: the name comes from the visible text
                    ("Search… ⌘K"), so speech-input users can say what they see. */}
                <Box
                    component="kbd"
                    sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: "6px",
                        border: 1,
                        borderColor: "divider",
                        bgcolor: harbor.countBg,
                        color: harbor.sub,
                        fontFamily: "inherit",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        lineHeight: 1.4,
                        whiteSpace: "nowrap",
                    }}
                >
                    {hint}
                </Box>
            </ButtonBase>

            <IconButton
                size="small"
                onClick={openSwitcher}
                aria-label="Search"
                aria-haspopup="dialog"
                aria-keyshortcuts={keyShortcuts}
                sx={{ display: { xs: "inline-flex", md: "none" } }}
            >
                <SearchIcon sx={{ color: harbor.sub }} />
            </IconButton>

            <Dialog
                open={open}
                onClose={closeSwitcher}
                fullWidth
                maxWidth="sm"
                aria-labelledby={titleId}
                transitionDuration={{ enter: 150, exit: 100 }}
                sx={{ "& .MuiDialog-container": { alignItems: "flex-start" } }}
                slotProps={{
                    paper: {
                        sx: {
                            m: { xs: 1, sm: 4 },
                            mt: { xs: 1, sm: "10vh" },
                            width: {
                                xs: "calc(100% - 16px)",
                                sm: "calc(100% - 64px)",
                            },
                            maxHeight: {
                                xs: "calc(100% - 16px)",
                                sm: "min(72vh, 640px)",
                            },
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        },
                    },
                }}
            >
                <QuickSwitcherPanel
                    titleId={titleId}
                    onNavigate={closeSwitcher}
                />
            </Dialog>
        </>
    );
}
