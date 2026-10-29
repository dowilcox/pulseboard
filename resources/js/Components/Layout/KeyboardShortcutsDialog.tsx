import {
    type RegisteredShortcut,
    SCOPE_LABELS,
    SCOPE_ORDER,
    type ShortcutScope,
    useKeyboardShortcuts,
    useRegisteredShortcuts,
} from "@/Contexts/KeyboardShortcutsContext";
import { harbor } from "@/theme/harbor";
import {
    comboLabels,
    isSingleKeyCombo,
    parseCombo,
} from "@/utils/keyboardShortcuts";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { Fragment, useId, useMemo } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
}

const KBD_SX = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 22,
    height: 22,
    px: 0.75,
    borderRadius: "6px",
    border: 1,
    borderColor: "divider",
    bgcolor: harbor.countBg,
    color: harbor.ink,
    fontFamily: "inherit",
    fontSize: "0.72rem",
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: "nowrap",
} as const;

const CONNECTOR_SX = {
    color: harbor.sub,
    fontSize: "0.72rem",
    mx: 0.5,
} as const;

/** Key caps for one spec: "g d" → [g] then [d]; "mod+k" → [⌘][K]. */
export function ShortcutKeys({
    spec,
    apple,
}: {
    spec: string;
    apple: boolean;
}) {
    const strokes = comboLabels(spec, apple);
    return (
        <Box
            component="span"
            sx={{ display: "inline-flex", alignItems: "center" }}
        >
            {strokes.map((caps, i) => (
                <Fragment key={i}>
                    {i > 0 && (
                        <Box component="span" sx={CONNECTOR_SX}>
                            then
                        </Box>
                    )}
                    <Box
                        component="span"
                        sx={{ display: "inline-flex", gap: "3px" }}
                    >
                        {caps.map((cap, j) => (
                            <Box key={j} component="kbd" sx={KBD_SX}>
                                {cap}
                            </Box>
                        ))}
                    </Box>
                </Fragment>
            ))}
        </Box>
    );
}

interface Section {
    scope: ShortcutScope;
    groups: { name: string | undefined; items: RegisteredShortcut[] }[];
}

/** Group visible shortcuts by scope, then sub-group, in registration order. */
export function groupShortcuts(
    entries: readonly RegisteredShortcut[],
): Section[] {
    // One row per scope + id; the latest registration wins.
    const unique = new Map<string, RegisteredShortcut>();
    for (const entry of entries) {
        if (entry.hidden || !entry.enabled) continue;
        unique.set(`${entry.scope}:${entry.id}`, entry);
    }
    const visible = [...unique.values()].sort((a, b) => a.token - b.token);

    return SCOPE_ORDER.map((scope) => {
        const groups: Section["groups"] = [];
        for (const entry of visible) {
            if (entry.scope !== scope) continue;
            let group = groups.find((g) => g.name === entry.group);
            if (!group) {
                group = { name: entry.group, items: [] };
                groups.push(group);
            }
            group.items.push(entry);
        }
        return { scope, groups };
    }).filter((section) => section.groups.length > 0);
}

/**
 * "?" overlay: every shortcut registered right now (so it reflects the
 * current page), with platform key labels and the single-key preference.
 */
export default function KeyboardShortcutsDialog({ open, onClose }: Props) {
    const titleId = useId();
    const { apple, singleKeyEnabled, setSingleKeyEnabled } =
        useKeyboardShortcuts();
    const entries = useRegisteredShortcuts();
    const sections = useMemo(() => groupShortcuts(entries), [entries]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            aria-labelledby={titleId}
            scroll="paper"
        >
            <DialogTitle
                id={titleId}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    pr: 1.5,
                }}
            >
                Keyboard shortcuts
                <IconButton
                    onClick={onClose}
                    aria-label="Close keyboard shortcuts"
                    size="small"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        mb: 2,
                        p: 1.5,
                        borderRadius: "12px",
                        bgcolor: harbor.countBg,
                    }}
                >
                    <FormControlLabel
                        control={
                            <Switch
                                checked={singleKeyEnabled}
                                onChange={(e) =>
                                    setSingleKeyEnabled(e.target.checked)
                                }
                            />
                        }
                        label="Single-key shortcuts"
                        sx={{ mr: 0 }}
                    />
                    <Typography variant="body2" sx={{ color: harbor.sub }}>
                        {singleKeyEnabled
                            ? "Paused while you type in a field or editor."
                            : `Off in this browser. Shortcuts with ${apple ? "⌘" : "Ctrl"} and Esc still work.`}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            md: sections.length > 1 ? "1fr 1fr" : "1fr",
                        },
                        columnGap: 4,
                        rowGap: 2.5,
                    }}
                >
                    {sections.map((section) => (
                        <Box
                            key={section.scope}
                            component="section"
                            aria-labelledby={`${titleId}-${section.scope}`}
                        >
                            <Typography
                                id={`${titleId}-${section.scope}`}
                                component="h3"
                                sx={{
                                    fontFamily: harbor.headingFont,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: harbor.ink,
                                    mb: 1,
                                }}
                            >
                                {SCOPE_LABELS[section.scope]}
                            </Typography>
                            {section.groups.map((group) => (
                                <Box key={group.name ?? ""} sx={{ mb: 1.5 }}>
                                    {group.name && (
                                        <Typography
                                            component="h4"
                                            sx={{
                                                fontSize: 10.5,
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.07em",
                                                color: harbor.faint,
                                                mb: 0.5,
                                            }}
                                        >
                                            {group.name}
                                        </Typography>
                                    )}
                                    <Box
                                        component="dl"
                                        sx={{
                                            m: 0,
                                            display: "grid",
                                            gap: 0.25,
                                        }}
                                    >
                                        {group.items.map((entry) => (
                                            <ShortcutRow
                                                key={entry.token}
                                                entry={entry}
                                                apple={apple}
                                                singleKeyEnabled={
                                                    singleKeyEnabled
                                                }
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    ))}
                </Box>
            </DialogContent>
        </Dialog>
    );
}

function ShortcutRow({
    entry,
    apple,
    singleKeyEnabled,
}: {
    entry: RegisteredShortcut;
    apple: boolean;
    singleKeyEnabled: boolean;
}) {
    const usable = entry.keys.filter(
        (spec) =>
            singleKeyEnabled ||
            entry.essential ||
            !isSingleKeyCombo(parseCombo(spec)),
    );
    const off = usable.length === 0;
    const shown = off ? entry.keys : usable;

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                py: 0.5,
                borderBottom: `1px solid ${harbor.cardBorder}`,
                opacity: off ? 0.55 : 1,
            }}
        >
            <Box
                component="dt"
                sx={{ fontSize: 13.5, color: harbor.ink, minWidth: 0 }}
            >
                {entry.description}
                {off && (
                    <Box component="span" sx={{ color: harbor.sub }}>
                        {" "}
                        (off)
                    </Box>
                )}
            </Box>
            <Box
                component="dd"
                sx={{
                    m: 0,
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    flexShrink: 0,
                }}
            >
                {shown.map((spec, i) => (
                    <Fragment key={spec}>
                        {i > 0 && (
                            <Box component="span" sx={CONNECTOR_SX}>
                                or
                            </Box>
                        )}
                        <ShortcutKeys spec={spec} apple={apple} />
                    </Fragment>
                ))}
            </Box>
        </Box>
    );
}
