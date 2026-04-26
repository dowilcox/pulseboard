import axios from "axios";
import { PRIORITY_OPTIONS } from "@/constants/priorities";
import type { Label, SavedFilter, Task, User } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import Autocomplete from "@mui/material/Autocomplete";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSnackbar } from "@/Contexts/SnackbarContext";

interface Filters {
    search: string;
    assignees: string[];
    labels: string[];
    priorities: string[];
    dueDateFrom: string;
    dueDateTo: string;
}

const EMPTY_FILTERS: Filters = {
    search: "",
    assignees: [],
    labels: [],
    priorities: [],
    dueDateFrom: "",
    dueDateTo: "",
};

interface Props {
    members: User[];
    labels: Label[];
    teamId: string;
    boardId: string;
    onFilterChange: (filterFn: (task: Task) => boolean) => void;
}

export default function FilterBar({
    members,
    labels,
    teamId,
    boardId,
    onFilterChange,
}: Props) {
    const { showSnackbar } = useSnackbar();
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
    const [savedFiltersMenuAnchor, setSavedFiltersMenuAnchor] =
        useState<HTMLElement | null>(null);
    const [savePopoverAnchor, setSavePopoverAnchor] =
        useState<HTMLElement | null>(null);
    const [saveFilterName, setSaveFilterName] = useState("");
    const [saveFilterDefault, setSaveFilterDefault] = useState(false);
    const defaultAppliedRef = useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.search) count++;
        if (filters.assignees.length > 0) count++;
        if (filters.labels.length > 0) count++;
        if (filters.priorities.length > 0) count++;
        if (filters.dueDateFrom || filters.dueDateTo) count++;
        return count;
    }, [filters]);

    const applyFilters = useCallback(
        (newFilters: Filters) => {
            setFilters(newFilters);

            const hasAnyFilter =
                newFilters.search ||
                newFilters.assignees.length > 0 ||
                newFilters.labels.length > 0 ||
                newFilters.priorities.length > 0 ||
                newFilters.dueDateFrom ||
                newFilters.dueDateTo;

            if (!hasAnyFilter) {
                onFilterChange(() => true);
                return;
            }

            onFilterChange((task: Task) => {
                // Search by title
                if (newFilters.search) {
                    const searchLower = newFilters.search.toLowerCase();
                    if (!task.title.toLowerCase().includes(searchLower)) {
                        return false;
                    }
                }

                // Filter by assignees
                if (newFilters.assignees.length > 0) {
                    const taskAssigneeIds = (task.assignees ?? []).map(
                        (a) => a.id,
                    );
                    if (
                        !newFilters.assignees.some((id) =>
                            taskAssigneeIds.includes(id),
                        )
                    ) {
                        return false;
                    }
                }

                // Filter by labels
                if (newFilters.labels.length > 0) {
                    const taskLabelIds = (task.labels ?? []).map((l) => l.id);
                    if (
                        !newFilters.labels.some((id) =>
                            taskLabelIds.includes(id),
                        )
                    ) {
                        return false;
                    }
                }

                // Filter by priority
                if (newFilters.priorities.length > 0) {
                    if (!newFilters.priorities.includes(task.priority)) {
                        return false;
                    }
                }

                // Filter by due date range
                if (newFilters.dueDateFrom || newFilters.dueDateTo) {
                    if (!task.due_date) return false;
                    const taskDate = task.due_date;
                    if (
                        newFilters.dueDateFrom &&
                        taskDate < newFilters.dueDateFrom
                    )
                        return false;
                    if (newFilters.dueDateTo && taskDate > newFilters.dueDateTo)
                        return false;
                }

                return true;
            });
        },
        [onFilterChange],
    );

    const updateFilter = <K extends keyof Filters>(
        key: K,
        value: Filters[K],
    ) => {
        const newFilters = { ...filters, [key]: value };
        applyFilters(newFilters);
    };

    const clearAll = () => {
        applyFilters(EMPTY_FILTERS);
    };

    // Load saved filters on mount
    const fetchSavedFilters = useCallback(() => {
        const controller = new AbortController();
        axios
            .get(route("boards.filters.index", [teamId, boardId]), {
                signal: controller.signal,
            })
            .then(({ data }) => setSavedFilters(data as SavedFilter[]))
            .catch((err) => {
                if (axios.isCancel(err)) return;
                showSnackbar("Failed to load saved filters", "error");
            });
        return controller;
    }, [teamId, boardId, showSnackbar]);

    useEffect(() => {
        const controller = fetchSavedFilters();
        return () => controller.abort();
    }, [fetchSavedFilters]);

    // Auto-apply default filter on first load
    useEffect(() => {
        if (defaultAppliedRef.current || savedFilters.length === 0) return;
        const defaultFilter = savedFilters.find((f) => f.is_default);
        if (defaultFilter) {
            const config = defaultFilter.filter_config as Partial<Filters>;
            applyFilters({ ...EMPTY_FILTERS, ...config });
        }
        defaultAppliedRef.current = true;
    }, [savedFilters, applyFilters]);

    const handleSaveFilter = () => {
        if (!saveFilterName.trim()) return;
        axios
            .post(route("boards.filters.store", [teamId, boardId]), {
                name: saveFilterName.trim(),
                filter_config: filters,
                is_default: saveFilterDefault,
            })
            .then(() => {
                fetchSavedFilters();
                setSavePopoverAnchor(null);
                setSaveFilterName("");
                setSaveFilterDefault(false);
            })
            .catch(() => showSnackbar("Failed to save filter", "error"));
    };

    const handleDeleteFilter = (filterId: string) => {
        axios
            .delete(
                route("boards.filters.destroy", [teamId, boardId, filterId]),
            )
            .then(() => {
                setSavedFilters((prev) =>
                    prev.filter((f) => f.id !== filterId),
                );
            })
            .catch(() => showSnackbar("Failed to delete filter", "error"));
    };

    const handleApplySavedFilter = (savedFilter: SavedFilter) => {
        const config = savedFilter.filter_config as Partial<Filters>;
        applyFilters({ ...EMPTY_FILTERS, ...config });
        setSavedFiltersMenuAnchor(null);
    };

    return (
        <Box
            sx={{
                display: "flex",
                gap: 1.25,
                alignItems: "center",
                flexWrap: "wrap",
                mb: 2.5,
                px: 0,
            }}
        >
            <Badge
                badgeContent={activeFilterCount}
                color="primary"
                sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem" } }}
            >
                <FilterListIcon sx={{ color: "text.secondary" }} />
            </Badge>

            {/* Saved Filters dropdown */}
            <Tooltip title="Saved filters">
                <IconButton
                    size="small"
                    onClick={(e) => setSavedFiltersMenuAnchor(e.currentTarget)}
                    aria-label="Saved filters"
                >
                    {savedFilters.length > 0 ? (
                        <BookmarkIcon fontSize="small" />
                    ) : (
                        <BookmarkBorderIcon fontSize="small" />
                    )}
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={savedFiltersMenuAnchor}
                open={Boolean(savedFiltersMenuAnchor)}
                onClose={() => setSavedFiltersMenuAnchor(null)}
                slotProps={{ paper: { sx: { minWidth: 200, maxWidth: 300 } } }}
            >
                {savedFilters.length === 0 ? (
                    <MenuItem disabled>
                        <Typography variant="body2" color="text.secondary">
                            No saved filters
                        </Typography>
                    </MenuItem>
                ) : (
                    savedFilters.map((sf) => (
                        <MenuItem
                            key={sf.id}
                            onClick={() => handleApplySavedFilter(sf)}
                            sx={{ pr: 1 }}
                        >
                            {sf.is_default && (
                                <ListItemIcon sx={{ minWidth: 28 }}>
                                    <StarIcon
                                        sx={{
                                            fontSize: 16,
                                            color: "warning.main",
                                        }}
                                    />
                                </ListItemIcon>
                            )}
                            <ListItemText
                                inset={!sf.is_default}
                                primary={sf.name}
                                slotProps={{
                                    primary: { sx: { fontSize: "0.875rem" } },
                                }}
                            />
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFilter(sf.id);
                                }}
                                aria-label={`Delete filter ${sf.name}`}
                                sx={{ ml: 1 }}
                            >
                                <CloseIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </MenuItem>
                    ))
                )}
            </Menu>

            {/* Save current filter button */}
            {activeFilterCount > 0 && (
                <>
                    <Tooltip title="Save current filter">
                        <IconButton
                            size="small"
                            onClick={(e) =>
                                setSavePopoverAnchor(e.currentTarget)
                            }
                            aria-label="Save current filter"
                        >
                            <SaveIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Popover
                        open={Boolean(savePopoverAnchor)}
                        anchorEl={savePopoverAnchor}
                        onClose={() => {
                            setSavePopoverAnchor(null);
                            setSaveFilterName("");
                            setSaveFilterDefault(false);
                        }}
                        anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "left",
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                display: "flex",
                                flexDirection: "column",
                                gap: 1.5,
                                minWidth: 250,
                            }}
                        >
                            <Typography variant="subtitle2">
                                Save Filter
                            </Typography>
                            <TextField
                                size="small"
                                label="Filter name"
                                value={saveFilterName}
                                onChange={(e) =>
                                    setSaveFilterName(e.target.value)
                                }
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveFilter();
                                }}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={saveFilterDefault}
                                        onChange={(e) =>
                                            setSaveFilterDefault(
                                                e.target.checked,
                                            )
                                        }
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        Set as default
                                    </Typography>
                                }
                            />
                            <Button
                                variant="contained"
                                size="small"
                                onClick={handleSaveFilter}
                                disabled={!saveFilterName.trim()}
                            >
                                Save
                            </Button>
                        </Box>
                    </Popover>
                </>
            )}

            {/* Search */}
            <TextField
                size="small"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                sx={{ minWidth: { xs: "100%", sm: 260 } }}
                slotProps={{
                    input: {
                        inputProps: { "aria-label": "Search tasks" },
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon
                                    sx={{
                                        fontSize: 18,
                                        color: "text.secondary",
                                    }}
                                />
                            </InputAdornment>
                        ),
                    },
                }}
            />

            {/* Assignee filter */}
            <Autocomplete
                multiple
                size="small"
                options={members}
                getOptionLabel={(opt) => opt.name}
                value={members.filter((m) => filters.assignees.includes(m.id))}
                onChange={(_, value) =>
                    updateFilter(
                        "assignees",
                        value.map((v) => v.id),
                    )
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder="Assignees"
                        inputProps={{
                            ...params.inputProps,
                            "aria-label": "Filter by assignees",
                        }}
                    />
                )}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip
                            {...getTagProps({ index })}
                            key={option.id}
                            label={option.name}
                            size="small"
                        />
                    ))
                }
                sx={{ minWidth: 170 }}
                limitTags={1}
            />

            {/* Label filter */}
            <Autocomplete
                multiple
                size="small"
                options={labels}
                getOptionLabel={(opt) => opt.name}
                value={labels.filter((l) => filters.labels.includes(l.id))}
                onChange={(_, value) =>
                    updateFilter(
                        "labels",
                        value.map((v) => v.id),
                    )
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder="Labels"
                        inputProps={{
                            ...params.inputProps,
                            "aria-label": "Filter by labels",
                        }}
                    />
                )}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip
                            {...getTagProps({ index })}
                            key={option.id}
                            label={option.name}
                            size="small"
                            sx={{
                                fontWeight: 600,
                                bgcolor: option.color,
                                color: getContrastText(option.color),
                            }}
                        />
                    ))
                }
                sx={{ minWidth: 150 }}
                limitTags={1}
            />

            {/* Priority filter */}
            <Select
                multiple
                size="small"
                displayEmpty
                value={filters.priorities}
                onChange={(e) =>
                    updateFilter("priorities", e.target.value as string[])
                }
                inputProps={{ "aria-label": "Filter by priority" }}
                renderValue={(selected) =>
                    selected.length === 0 ? (
                        <Box component="span" sx={{ color: "text.secondary" }}>
                            Priority
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                            {(selected as string[]).map((p) => {
                                const opt = PRIORITY_OPTIONS.find(
                                    (o) => o.value === p,
                                );
                                return (
                                    <Chip
                                        key={p}
                                        label={opt?.label ?? p}
                                        size="small"
                                        sx={{ height: 20, fontSize: "0.65rem" }}
                                    />
                                );
                            })}
                        </Box>
                    )
                }
                sx={{ minWidth: 120 }}
            >
                {PRIORITY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: opt.color,
                                border:
                                    opt.color === "transparent"
                                        ? "1px solid"
                                        : "none",
                                borderColor: "divider",
                                mr: 1,
                            }}
                        />
                        {opt.label}
                    </MenuItem>
                ))}
            </Select>

            {/* Due date range */}
            <TextField
                size="small"
                type="date"
                label="From"
                value={filters.dueDateFrom}
                onChange={(e) => updateFilter("dueDateFrom", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 145 }}
            />
            <TextField
                size="small"
                type="date"
                label="To"
                value={filters.dueDateTo}
                onChange={(e) => updateFilter("dueDateTo", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 145 }}
            />

            {/* Clear all */}
            {activeFilterCount > 0 && (
                <Tooltip title="Clear all filters">
                    <IconButton
                        size="small"
                        onClick={clearAll}
                        aria-label="Clear all filters"
                    >
                        <ClearIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );
}
