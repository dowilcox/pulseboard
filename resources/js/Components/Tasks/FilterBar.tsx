import axios from "axios";
import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import PriorityIndicator from "@/Components/Tasks/PriorityIndicator";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import { harbor, harborAvatarColor, harborHex } from "@/theme/harbor";
import type { Column, Label, SavedFilter, User } from "@/types";
import {
    countPopoverFilters,
    filtersToConfig,
    hasActiveFilters,
    PRIORITY_VALUES,
    type BoardFilters,
} from "@/utils/boardFilters";
import { formatDueDate } from "@/utils/formatTimestamp";
import { priorityLabel } from "@/utils/taskCardLabel";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SearchIcon from "@mui/icons-material/Search";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StarIcon from "@mui/icons-material/Star";
import TuneIcon from "@mui/icons-material/Tune";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
    type FormEvent,
    type ReactNode,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";

// ── Shared styles ─────────────────────────────────────────────────────

const CONTROL_HEIGHT = 34;

const TOOLBAR_BUTTON_SX = {
    height: CONTROL_HEIGHT,
    px: 1.5,
    borderRadius: "999px",
    bgcolor: harbor.card,
    color: harbor.ink,
    border: `1px solid ${harborHex.inputBorder}`,
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    flexShrink: 0,
    "& .MuiButton-startIcon": { mr: 0.75 },
    "& .MuiButton-endIcon": { ml: 0.25 },
    "&:hover": { bgcolor: harbor.countBg, borderColor: harbor.faint },
} as const;

const TOOLBAR_BUTTON_ACTIVE_SX = {
    bgcolor: harbor.tints.indigo.bg,
    color: harbor.tints.indigo.fg,
    borderColor: harborHex.accent,
    "&:hover": {
        bgcolor: harbor.tints.indigo.bg,
        borderColor: harborHex.accentDark,
    },
} as const;

const POPOVER_PAPER_SX = {
    p: 2,
    width: { xs: "calc(100vw - 32px)", sm: "auto" },
    maxWidth: { xs: "calc(100vw - 32px)", sm: 560 },
    maxHeight: "min(70vh, 560px)",
    overflowY: "auto",
} as const;

const LEGEND_SX = {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: harbor.sub,
    mb: 0.5,
    "&.Mui-focused": { color: harbor.sub },
} as const;

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase();
}

function MemberAvatar({ user, size = 22 }: { user: User; size?: number }) {
    return (
        <Avatar
            alt=""
            src={user.avatar_url}
            sx={{
                width: size,
                height: size,
                fontSize: size * 0.42,
                bgcolor: harborAvatarColor(user.name),
                color: "#ffffff",
            }}
        >
            {initials(user.name)}
        </Avatar>
    );
}

/** Removable filter pill: static text plus a labelled remove button. */
function FilterChip({
    label,
    removeLabel,
    onRemove,
    icon,
    tone = "neutral",
}: {
    label: string;
    removeLabel: string;
    onRemove: () => void;
    icon?: ReactNode;
    tone?: "neutral" | "saved";
}) {
    const saved = tone === "saved";
    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                height: CONTROL_HEIGHT - 4,
                pl: 1.25,
                pr: 0.25,
                borderRadius: "999px",
                border: "1px solid",
                borderColor: saved ? harborHex.accent : harborHex.inputBorder,
                bgcolor: saved ? harbor.tints.indigo.bg : harbor.card,
                color: saved ? harbor.tints.indigo.fg : harbor.ink,
                fontSize: "12.5px",
                fontWeight: 700,
                maxWidth: "100%",
                minWidth: 0,
                flexShrink: 1,
            }}
        >
            {icon}
            <Box
                component="span"
                sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                }}
            >
                {label}
            </Box>
            <IconButton
                size="small"
                aria-label={removeLabel}
                onClick={onRemove}
                sx={{
                    width: 24,
                    height: 24,
                    color: "inherit",
                }}
            >
                <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
        </Box>
    );
}

function CheckboxRow({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: ReactNode;
}) {
    return (
        <FormControlLabel
            control={
                <Checkbox
                    size="small"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    sx={{ py: 0.5 }}
                />
            }
            label={label}
            sx={{
                mr: 0,
                "& .MuiFormControlLabel-label": {
                    fontSize: "13.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                },
            }}
        />
    );
}

function toggleValue(list: string[], value: string, on: boolean): string[] {
    return on
        ? list.includes(value)
            ? list
            : [...list, value]
        : list.filter((v) => v !== value);
}

function sortByName(filters: SavedFilter[]): SavedFilter[] {
    return [...filters].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Filter bar ────────────────────────────────────────────────────────

interface Props {
    members: User[];
    labels: Label[];
    columns: Column[];
    filters: BoardFilters;
    onFiltersChange: (filters: BoardFilters) => void;
    onClearFilters: () => void;
    savedFilters: SavedFilter[];
    activeSavedFilterId: string | null;
    onApplySavedFilter: (filter: SavedFilter) => void;
    onSavedFiltersChange: (filters: SavedFilter[]) => void;
    teamSlug: string;
    boardSlug: string;
    currentUserId: string;
}

export default function FilterBar({
    members,
    labels,
    columns,
    filters,
    onFiltersChange,
    onClearFilters,
    savedFilters,
    activeSavedFilterId,
    onApplySavedFilter,
    onSavedFiltersChange,
    teamSlug,
    boardSlug,
    currentUserId,
}: Props) {
    const { showSnackbar } = useSnackbar();
    const ids = useId();

    // ── Search (debounced) ───────────────────────────────────────────
    const [searchInput, setSearchInput] = useState(filters.search);
    const committedSearch = useRef(filters.search);
    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    // Outside changes (Clear all, a saved filter, Back) replace the input
    useEffect(() => {
        if (filters.search !== committedSearch.current) {
            committedSearch.current = filters.search;
            setSearchInput(filters.search);
        }
    }, [filters.search]);

    useEffect(() => {
        if (searchInput === committedSearch.current) return;
        const timer = setTimeout(() => {
            committedSearch.current = searchInput;
            onFiltersChange({ ...filtersRef.current, search: searchInput });
        }, 250);
        return () => clearTimeout(timer);
    }, [searchInput, onFiltersChange]);

    /** Apply a change, keeping any not-yet-debounced search text. */
    const update = (patch: Partial<BoardFilters>) => {
        committedSearch.current = searchInput;
        onFiltersChange({ ...filters, search: searchInput, ...patch });
    };

    // ── Popover state ────────────────────────────────────────────────
    const [assigneeAnchor, setAssigneeAnchor] = useState<HTMLElement | null>(
        null,
    );
    const [filtersAnchor, setFiltersAnchor] = useState<HTMLElement | null>(
        null,
    );
    const [savedAnchor, setSavedAnchor] = useState<HTMLElement | null>(null);
    const [saveAnchor, setSaveAnchor] = useState<HTMLElement | null>(null);
    const [memberQuery, setMemberQuery] = useState("");
    const [saveName, setSaveName] = useState("");
    const [saveAsDefault, setSaveAsDefault] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<SavedFilter | null>(
        null,
    );

    const clearAll = () => {
        committedSearch.current = "";
        setSearchInput("");
        onClearFilters();
    };

    const currentFilters: BoardFilters = { ...filters, search: searchInput };
    const anyActive = hasActiveFilters(currentFilters);
    const popoverCount = countPopoverFilters(filters);
    const activeSaved =
        savedFilters.find((f) => f.id === activeSavedFilterId) ?? null;

    // ── Assignees ────────────────────────────────────────────────────
    const sortedMembers = useMemo(() => {
        const me = members.find((m) => m.id === currentUserId);
        const others = members
            .filter((m) => m.id !== currentUserId)
            .sort((a, b) => a.name.localeCompare(b.name));
        return me ? [me, ...others] : others;
    }, [members, currentUserId]);

    const visibleMembers = useMemo(() => {
        const q = memberQuery.trim().toLowerCase();
        return q
            ? sortedMembers.filter((m) => m.name.toLowerCase().includes(q))
            : sortedMembers;
    }, [sortedMembers, memberQuery]);

    const selectedMembers = sortedMembers.filter((m) =>
        filters.assignees.includes(m.id),
    );
    // Ids from a URL or saved filter may belong to people who have since
    // left the team.
    const formerCount = filters.assignees.length - selectedMembers.length;
    const selectedNames = [
        ...selectedMembers.map((m) => m.name),
        ...(formerCount > 0
            ? [
                  formerCount === 1
                      ? "a former member"
                      : `${formerCount} former members`,
              ]
            : []),
    ];
    const assigneeButtonText =
        filters.assignees.length === 0
            ? "Assignee"
            : selectedMembers.length === 1 && formerCount === 0
              ? selectedMembers[0].name
              : filters.assignees.length === 1
                ? "1 former member"
                : `${filters.assignees.length} people`;
    const assigneeAriaLabel =
        filters.assignees.length === 0
            ? "Assignee filter: anyone"
            : selectedNames.length === 1
              ? `Assignee filter: ${assigneeButtonText}`
              : `Assignee filter: ${assigneeButtonText} (${selectedNames.join(", ")})`;

    // ── Chips for filters hidden in the popover ──────────────────────
    const columnNames = new Map(columns.map((c) => [c.id, c.name]));
    const labelNames = new Map(labels.map((l) => [l.id, l.name]));
    const chips: {
        key: string;
        label: string;
        removeLabel: string;
        onRemove: () => void;
    }[] = [];
    if (filters.priorities.length > 0) {
        const text = filters.priorities
            .map((p) =>
                p === "none"
                    ? "None"
                    : priorityLabel(p as (typeof PRIORITY_VALUES)[number]),
            )
            .join(", ");
        chips.push({
            key: "priority",
            label: `Priority: ${text}`,
            removeLabel: `Remove priority filter (${text})`,
            onRemove: () => update({ priorities: [] }),
        });
    }
    if (filters.columns.length > 0) {
        const text = filters.columns
            .map((id) => columnNames.get(id) ?? "Unknown column")
            .join(", ");
        chips.push({
            key: "columns",
            label: `Status: ${text}`,
            removeLabel: `Remove status filter (${text})`,
            onRemove: () => update({ columns: [] }),
        });
    }
    if (filters.labels.length > 0) {
        const text = filters.labels
            .map((id) => labelNames.get(id) ?? "Unknown label")
            .join(", ");
        chips.push({
            key: "labels",
            label: `${filters.labels.length === 1 ? "Label" : "Labels"}: ${text}`,
            removeLabel: `Remove label filter (${text})`,
            onRemove: () => update({ labels: [] }),
        });
    }
    if (filters.dueDateFrom || filters.dueDateTo) {
        const from = filters.dueDateFrom && formatDueDate(filters.dueDateFrom);
        const to = filters.dueDateTo && formatDueDate(filters.dueDateTo);
        const text =
            from && to
                ? `Due ${from} – ${to}`
                : from
                  ? `Due from ${from}`
                  : `Due by ${to}`;
        chips.push({
            key: "due",
            label: text,
            removeLabel: `Remove due date filter (${text})`,
            onRemove: () => update({ dueDateFrom: "", dueDateTo: "" }),
        });
    }

    // ── Saved filters ────────────────────────────────────────────────
    const closeSave = () => {
        setSaveAnchor(null);
        setSaveName("");
        setSaveAsDefault(false);
    };

    const handleSaveFilter = (e: FormEvent) => {
        e.preventDefault();
        const name = saveName.trim();
        if (!name || saving) return;
        setSaving(true);
        axios
            .post<SavedFilter>(
                route("boards.filters.store", [teamSlug, boardSlug]),
                {
                    name,
                    filter_config: filtersToConfig(currentFilters),
                    is_default: saveAsDefault,
                },
            )
            .then(({ data: created }) => {
                const others = savedFilters.map((f) =>
                    created.is_default ? { ...f, is_default: false } : f,
                );
                onSavedFiltersChange(sortByName([...others, created]));
                onApplySavedFilter(created);
                showSnackbar(`Saved filter “${created.name}”`, "success");
                closeSave();
            })
            .catch(() => showSnackbar("Failed to save filter", "error"))
            .finally(() => setSaving(false));
    };

    const handleToggleDefault = (savedFilter: SavedFilter) => {
        const makeDefault = !savedFilter.is_default;
        axios
            .put<SavedFilter>(
                route("boards.filters.update", [
                    teamSlug,
                    boardSlug,
                    savedFilter.id,
                ]),
                { is_default: makeDefault },
            )
            .then(({ data: updated }) => {
                onSavedFiltersChange(
                    savedFilters.map((f) =>
                        f.id === updated.id
                            ? updated
                            : makeDefault
                              ? { ...f, is_default: false }
                              : f,
                    ),
                );
                showSnackbar(
                    makeDefault
                        ? `“${updated.name}” now applies when you open this board`
                        : `“${updated.name}” is no longer the default`,
                    "success",
                );
            })
            .catch(() => showSnackbar("Failed to update filter", "error"));
    };

    const handleDeleteFilter = () => {
        const target = pendingDelete;
        setPendingDelete(null);
        if (!target) return;
        axios
            .delete(
                route("boards.filters.destroy", [
                    teamSlug,
                    boardSlug,
                    target.id,
                ]),
            )
            .then(() => {
                onSavedFiltersChange(
                    savedFilters.filter((f) => f.id !== target.id),
                );
                showSnackbar(
                    `Deleted saved filter “${target.name}”`,
                    "success",
                );
            })
            .catch(() => showSnackbar("Failed to delete filter", "error"));
    };

    const assigneeTitleId = `${ids}-assignee-title`;
    const filtersTitleId = `${ids}-filters-title`;
    const savedTitleId = `${ids}-saved-title`;
    const saveTitleId = `${ids}-save-title`;

    return (
        <Box
            role="search"
            aria-label="Filter tasks"
            sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                flexWrap: "wrap",
                mb: 1.5,
                minWidth: 0,
            }}
        >
            {activeSaved && (
                <FilterChip
                    tone="saved"
                    icon={<BookmarkIcon sx={{ fontSize: 15 }} />}
                    label={activeSaved.name}
                    removeLabel={`Remove saved filter ${activeSaved.name}`}
                    onRemove={clearAll}
                />
            )}

            {/* Search */}
            <TextField
                size="small"
                placeholder="Search tasks"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Escape" && searchInput) {
                        e.preventDefault();
                        setSearchInput("");
                    }
                }}
                sx={{
                    flex: { xs: "1 1 100%", sm: "0 1 240px" },
                    minWidth: { sm: 180 },
                    "& .MuiOutlinedInput-root": {
                        height: CONTROL_HEIGHT,
                        borderRadius: "999px",
                        bgcolor: harbor.card,
                        fontSize: "13px",
                        pr: 0.5,
                    },
                    "& input::placeholder": { color: harbor.sub, opacity: 1 },
                }}
                slotProps={{
                    htmlInput: { "aria-label": "Search tasks" },
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon
                                    sx={{ fontSize: 17, color: harbor.sub }}
                                />
                            </InputAdornment>
                        ),
                        endAdornment: searchInput ? (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    aria-label="Clear search"
                                    onClick={() => setSearchInput("")}
                                    sx={{ width: 26, height: 26 }}
                                >
                                    <CloseIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </InputAdornment>
                        ) : undefined,
                    },
                }}
            />

            {/* Assignee picker */}
            <Button
                onClick={(e) => setAssigneeAnchor(e.currentTarget)}
                aria-haspopup="dialog"
                aria-expanded={assigneeAnchor ? "true" : undefined}
                aria-label={assigneeAriaLabel}
                startIcon={
                    selectedMembers.length === 0 ? (
                        <PersonOutlineIcon
                            sx={{ fontSize: "18px !important" }}
                        />
                    ) : (
                        <AvatarGroup
                            max={3}
                            sx={{
                                "& .MuiAvatar-root": {
                                    width: 20,
                                    height: 20,
                                    fontSize: 9,
                                    border: `1.5px solid ${harbor.card}`,
                                },
                            }}
                        >
                            {selectedMembers.map((m) => (
                                <MemberAvatar key={m.id} user={m} size={20} />
                            ))}
                        </AvatarGroup>
                    )
                }
                endIcon={<ArrowDropDownIcon />}
                sx={{
                    ...TOOLBAR_BUTTON_SX,
                    ...(filters.assignees.length > 0 &&
                        TOOLBAR_BUTTON_ACTIVE_SX),
                    maxWidth: 220,
                    "& .label": {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    },
                }}
            >
                <span className="label">{assigneeButtonText}</span>
            </Button>
            <Popover
                open={Boolean(assigneeAnchor)}
                anchorEl={assigneeAnchor}
                onClose={() => {
                    setAssigneeAnchor(null);
                    setMemberQuery("");
                }}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{
                    paper: {
                        role: "dialog",
                        "aria-labelledby": assigneeTitleId,
                        sx: {
                            ...POPOVER_PAPER_SX,
                            width: { xs: "calc(100vw - 32px)", sm: 300 },
                        },
                    },
                }}
            >
                <FormControl component="fieldset" sx={{ width: "100%" }}>
                    <FormLabel
                        component="legend"
                        id={assigneeTitleId}
                        sx={LEGEND_SX}
                    >
                        Assigned to
                    </FormLabel>
                    {sortedMembers.length > 8 && (
                        <TextField
                            size="small"
                            placeholder="Find a person"
                            value={memberQuery}
                            onChange={(e) => setMemberQuery(e.target.value)}
                            slotProps={{
                                htmlInput: { "aria-label": "Find a person" },
                            }}
                            sx={{ my: 1 }}
                            fullWidth
                        />
                    )}
                    <FormGroup>
                        {visibleMembers.map((member) => (
                            <CheckboxRow
                                key={member.id}
                                checked={filters.assignees.includes(member.id)}
                                onChange={(on) =>
                                    update({
                                        assignees: toggleValue(
                                            filters.assignees,
                                            member.id,
                                            on,
                                        ),
                                    })
                                }
                                label={
                                    <>
                                        <MemberAvatar user={member} />
                                        <Box
                                            component="span"
                                            sx={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {member.name}
                                            {member.id === currentUserId &&
                                                " (you)"}
                                        </Box>
                                    </>
                                }
                            />
                        ))}
                        {visibleMembers.length === 0 && (
                            <Typography
                                variant="body2"
                                sx={{ color: harbor.sub, py: 1 }}
                            >
                                No one matches “{memberQuery}”.
                            </Typography>
                        )}
                    </FormGroup>
                </FormControl>
                {filters.assignees.length > 0 && (
                    <Button
                        size="small"
                        onClick={() => update({ assignees: [] })}
                        sx={{ mt: 1 }}
                    >
                        Clear assignee filter
                    </Button>
                )}
            </Popover>

            {/* Labels / priority / status / due date */}
            <Button
                onClick={(e) => setFiltersAnchor(e.currentTarget)}
                aria-haspopup="dialog"
                aria-expanded={filtersAnchor ? "true" : undefined}
                aria-label={
                    popoverCount > 0
                        ? `Filters, ${popoverCount} active`
                        : undefined
                }
                startIcon={<TuneIcon sx={{ fontSize: "17px !important" }} />}
                sx={{
                    ...TOOLBAR_BUTTON_SX,
                    ...(popoverCount > 0 && TOOLBAR_BUTTON_ACTIVE_SX),
                }}
            >
                Filters
                {popoverCount > 0 && (
                    <Box
                        component="span"
                        sx={{
                            ml: 0.75,
                            minWidth: 18,
                            height: 18,
                            px: 0.5,
                            borderRadius: "999px",
                            bgcolor: harborHex.accent,
                            color: "#ffffff",
                            fontSize: "11px",
                            lineHeight: "18px",
                            textAlign: "center",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {popoverCount}
                    </Box>
                )}
            </Button>
            <Popover
                open={Boolean(filtersAnchor)}
                anchorEl={filtersAnchor}
                onClose={() => setFiltersAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{
                    paper: {
                        role: "dialog",
                        "aria-labelledby": filtersTitleId,
                        sx: POPOVER_PAPER_SX,
                    },
                }}
            >
                <Typography
                    id={filtersTitleId}
                    sx={{ fontWeight: 700, fontSize: "14px", mb: 1.5 }}
                >
                    Filter tasks
                </Typography>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        columnGap: 3,
                        rowGap: 2,
                    }}
                >
                    <FormControl component="fieldset">
                        <FormLabel component="legend" sx={LEGEND_SX}>
                            Priority
                        </FormLabel>
                        <FormGroup>
                            {PRIORITY_VALUES.map((priority) => (
                                <CheckboxRow
                                    key={priority}
                                    checked={filters.priorities.includes(
                                        priority,
                                    )}
                                    onChange={(on) =>
                                        update({
                                            priorities: toggleValue(
                                                filters.priorities,
                                                priority,
                                                on,
                                            ),
                                        })
                                    }
                                    label={
                                        priority === "none" ? (
                                            "No priority"
                                        ) : (
                                            <PriorityIndicator
                                                priority={priority}
                                                fontSize={13.5}
                                            />
                                        )
                                    }
                                />
                            ))}
                        </FormGroup>
                    </FormControl>

                    <FormControl component="fieldset">
                        <FormLabel component="legend" sx={LEGEND_SX}>
                            Status
                        </FormLabel>
                        <FormGroup>
                            {columns.map((column) => (
                                <CheckboxRow
                                    key={column.id}
                                    checked={filters.columns.includes(
                                        column.id,
                                    )}
                                    onChange={(on) =>
                                        update({
                                            columns: toggleValue(
                                                filters.columns,
                                                column.id,
                                                on,
                                            ),
                                        })
                                    }
                                    label={column.name}
                                />
                            ))}
                        </FormGroup>
                    </FormControl>

                    <FormControl component="fieldset">
                        <FormLabel component="legend" sx={LEGEND_SX}>
                            Labels
                        </FormLabel>
                        {labels.length === 0 ? (
                            <Typography
                                variant="body2"
                                sx={{ color: harbor.sub }}
                            >
                                This team has no labels yet.
                            </Typography>
                        ) : (
                            <FormGroup>
                                {labels.map((label) => (
                                    <CheckboxRow
                                        key={label.id}
                                        checked={filters.labels.includes(
                                            label.id,
                                        )}
                                        onChange={(on) =>
                                            update({
                                                labels: toggleValue(
                                                    filters.labels,
                                                    label.id,
                                                    on,
                                                ),
                                            })
                                        }
                                        label={
                                            <>
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: "50%",
                                                        bgcolor: label.color,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                {label.name}
                                            </>
                                        }
                                    />
                                ))}
                            </FormGroup>
                        )}
                    </FormControl>

                    <FormControl component="fieldset">
                        <FormLabel component="legend" sx={LEGEND_SX}>
                            Due date
                        </FormLabel>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1.5,
                                mt: 1,
                            }}
                        >
                            <TextField
                                size="small"
                                type="date"
                                label="From"
                                value={filters.dueDateFrom}
                                onChange={(e) =>
                                    update({ dueDateFrom: e.target.value })
                                }
                                slotProps={{
                                    inputLabel: { shrink: true },
                                    htmlInput: {
                                        max: filters.dueDateTo || undefined,
                                    },
                                }}
                            />
                            <TextField
                                size="small"
                                type="date"
                                label="To"
                                value={filters.dueDateTo}
                                onChange={(e) =>
                                    update({ dueDateTo: e.target.value })
                                }
                                slotProps={{
                                    inputLabel: { shrink: true },
                                    htmlInput: {
                                        min: filters.dueDateFrom || undefined,
                                    },
                                }}
                            />
                        </Box>
                    </FormControl>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 1,
                        mt: 2,
                    }}
                >
                    {popoverCount > 0 && (
                        <Button
                            onClick={() =>
                                update({
                                    labels: [],
                                    priorities: [],
                                    columns: [],
                                    dueDateFrom: "",
                                    dueDateTo: "",
                                })
                            }
                        >
                            Reset these filters
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={() => setFiltersAnchor(null)}
                    >
                        Done
                    </Button>
                </Box>
            </Popover>

            {/* Saved filters */}
            <Button
                onClick={(e) => setSavedAnchor(e.currentTarget)}
                aria-haspopup="dialog"
                aria-expanded={savedAnchor ? "true" : undefined}
                startIcon={
                    <BookmarkBorderIcon sx={{ fontSize: "17px !important" }} />
                }
                endIcon={<ArrowDropDownIcon />}
                sx={TOOLBAR_BUTTON_SX}
            >
                Saved filters
            </Button>
            <Popover
                open={Boolean(savedAnchor)}
                anchorEl={savedAnchor}
                onClose={() => setSavedAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{
                    paper: {
                        role: "dialog",
                        "aria-labelledby": savedTitleId,
                        sx: {
                            ...POPOVER_PAPER_SX,
                            p: 1.5,
                            width: { xs: "calc(100vw - 32px)", sm: 320 },
                        },
                    },
                }}
            >
                <Typography
                    id={savedTitleId}
                    sx={{ fontWeight: 700, fontSize: "14px", px: 0.5, mb: 1 }}
                >
                    Saved filters
                </Typography>
                {savedFilters.length === 0 ? (
                    <Typography
                        variant="body2"
                        sx={{ color: harbor.sub, px: 0.5, pb: 0.5 }}
                    >
                        No saved filters yet. Set some filters, then choose
                        “Save filter”.
                    </Typography>
                ) : (
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {savedFilters.map((sf) => {
                            const isActive = sf.id === activeSavedFilterId;
                            return (
                                <Box
                                    component="li"
                                    key={sf.id}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.25,
                                    }}
                                >
                                    <Button
                                        onClick={() => {
                                            onApplySavedFilter(sf);
                                            setSavedAnchor(null);
                                        }}
                                        aria-current={
                                            isActive ? "true" : undefined
                                        }
                                        startIcon={
                                            isActive ? (
                                                <CheckIcon />
                                            ) : (
                                                <Box
                                                    component="span"
                                                    sx={{ width: 20 }}
                                                />
                                            )
                                        }
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            justifyContent: "flex-start",
                                            color: harbor.ink,
                                            fontWeight: isActive ? 700 : 600,
                                            textAlign: "left",
                                            "& .label": {
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            },
                                        }}
                                    >
                                        <span className="label">{sf.name}</span>
                                    </Button>
                                    <Tooltip
                                        title={
                                            sf.is_default
                                                ? "Default: applies when you open this board"
                                                : "Make default"
                                        }
                                    >
                                        <IconButton
                                            size="small"
                                            aria-label={`Use “${sf.name}” as the default filter`}
                                            aria-pressed={sf.is_default}
                                            onClick={() =>
                                                handleToggleDefault(sf)
                                            }
                                            sx={{
                                                color: sf.is_default
                                                    ? harbor.secondary
                                                    : harbor.sub,
                                            }}
                                        >
                                            {sf.is_default ? (
                                                <StarIcon fontSize="small" />
                                            ) : (
                                                <StarBorderIcon fontSize="small" />
                                            )}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            aria-label={`Delete saved filter “${sf.name}”`}
                                            onClick={() => setPendingDelete(sf)}
                                            sx={{ color: harbor.sub }}
                                        >
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                {savedFilters.length > 0 && (
                    <Typography
                        variant="caption"
                        component="p"
                        sx={{ color: harbor.sub, px: 0.5, mt: 1 }}
                    >
                        The starred filter applies whenever you open this board.
                    </Typography>
                )}
            </Popover>

            {/* Save current filters */}
            {anyActive && !activeSaved && (
                <>
                    <Button
                        onClick={(e) => setSaveAnchor(e.currentTarget)}
                        aria-haspopup="dialog"
                        aria-expanded={saveAnchor ? "true" : undefined}
                        sx={{
                            ...TOOLBAR_BUTTON_SX,
                            border: "1px solid transparent",
                            bgcolor: "transparent",
                            color: harbor.accent,
                            "&:hover": { bgcolor: harbor.countBg },
                        }}
                    >
                        Save filter
                    </Button>
                    <Popover
                        open={Boolean(saveAnchor)}
                        anchorEl={saveAnchor}
                        onClose={closeSave}
                        anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "left",
                        }}
                        slotProps={{
                            paper: {
                                role: "dialog",
                                "aria-labelledby": saveTitleId,
                                sx: {
                                    ...POPOVER_PAPER_SX,
                                    width: {
                                        xs: "calc(100vw - 32px)",
                                        sm: 300,
                                    },
                                },
                            },
                        }}
                    >
                        <Box
                            component="form"
                            onSubmit={handleSaveFilter}
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1.5,
                            }}
                        >
                            <Typography
                                id={saveTitleId}
                                sx={{ fontWeight: 700, fontSize: "14px" }}
                            >
                                Save current filters
                            </Typography>
                            <TextField
                                size="small"
                                label="Name"
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                                autoFocus
                                required
                                slotProps={{ htmlInput: { maxLength: 255 } }}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={saveAsDefault}
                                        onChange={(e) =>
                                            setSaveAsDefault(e.target.checked)
                                        }
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        Apply when I open this board
                                    </Typography>
                                }
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!saveName.trim() || saving}
                            >
                                Save filter
                            </Button>
                        </Box>
                    </Popover>
                </>
            )}

            {chips.map((chip) => (
                <FilterChip
                    key={chip.key}
                    label={chip.label}
                    removeLabel={chip.removeLabel}
                    onRemove={chip.onRemove}
                />
            ))}

            {anyActive && (
                <Button
                    onClick={clearAll}
                    startIcon={
                        <CloseIcon sx={{ fontSize: "16px !important" }} />
                    }
                    sx={{
                        height: CONTROL_HEIGHT,
                        px: 1.25,
                        color: harbor.sub,
                        fontSize: "13px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        "&:hover": { bgcolor: harbor.countBg },
                    }}
                >
                    Clear all
                </Button>
            )}

            <ConfirmDialog
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDeleteFilter}
                title="Delete saved filter?"
                message={
                    pendingDelete
                        ? `“${pendingDelete.name}” will be removed from your saved filters on this board. This can't be undone.`
                        : ""
                }
                confirmLabel="Delete"
                confirmColor="error"
            />
        </Box>
    );
}
