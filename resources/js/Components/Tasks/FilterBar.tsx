import { PRIORITY_OPTIONS } from '@/constants/priorities';
import type { Label, Task, User } from '@/types';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import Autocomplete from '@mui/material/Autocomplete';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { useCallback, useMemo, useState } from 'react';

interface Filters {
    search: string;
    assignees: string[];
    labels: string[];
    priorities: string[];
    dueDateFrom: string;
    dueDateTo: string;
}

const EMPTY_FILTERS: Filters = {
    search: '',
    assignees: [],
    labels: [],
    priorities: [],
    dueDateFrom: '',
    dueDateTo: '',
};

interface Props {
    members: User[];
    labels: Label[];
    onFilterChange: (filterFn: (task: Task) => boolean) => void;
}

export default function FilterBar({ members, labels, onFilterChange }: Props) {
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

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
                    const taskAssigneeIds = (task.assignees ?? []).map((a) => a.id);
                    if (!newFilters.assignees.some((id) => taskAssigneeIds.includes(id))) {
                        return false;
                    }
                }

                // Filter by labels
                if (newFilters.labels.length > 0) {
                    const taskLabelIds = (task.labels ?? []).map((l) => l.id);
                    if (!newFilters.labels.some((id) => taskLabelIds.includes(id))) {
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
                    if (newFilters.dueDateFrom && taskDate < newFilters.dueDateFrom) return false;
                    if (newFilters.dueDateTo && taskDate > newFilters.dueDateTo) return false;
                }

                return true;
            });
        },
        [onFilterChange]
    );

    const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
        const newFilters = { ...filters, [key]: value };
        applyFilters(newFilters);
    };

    const clearAll = () => {
        applyFilters(EMPTY_FILTERS);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 2,
                px: 0.5,
            }}
        >
            <Badge badgeContent={activeFilterCount} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem' } }}>
                <FilterListIcon sx={{ color: 'text.secondary' }} />
            </Badge>

            {/* Search */}
            <TextField
                size="small"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                sx={{ minWidth: 180 }}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
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
                onChange={(_, value) => updateFilter('assignees', value.map((v) => v.id))}
                renderInput={(params) => <TextField {...params} placeholder="Assignees" />}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip {...getTagProps({ index })} key={option.id} label={option.name} size="small" />
                    ))
                }
                sx={{ minWidth: 160 }}
                limitTags={1}
            />

            {/* Label filter */}
            <Autocomplete
                multiple
                size="small"
                options={labels}
                getOptionLabel={(opt) => opt.name}
                value={labels.filter((l) => filters.labels.includes(l.id))}
                onChange={(_, value) => updateFilter('labels', value.map((v) => v.id))}
                renderInput={(params) => <TextField {...params} placeholder="Labels" />}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip
                            {...getTagProps({ index })}
                            key={option.id}
                            label={option.name}
                            size="small"
                            sx={{ bgcolor: option.color, color: '#fff' }}
                        />
                    ))
                }
                sx={{ minWidth: 140 }}
                limitTags={1}
            />

            {/* Priority filter */}
            <Select
                multiple
                size="small"
                displayEmpty
                value={filters.priorities}
                onChange={(e) => updateFilter('priorities', e.target.value as string[])}
                renderValue={(selected) =>
                    selected.length === 0 ? (
                        <Box component="span" sx={{ color: 'text.secondary' }}>
                            Priority
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {(selected as string[]).map((p) => {
                                const opt = PRIORITY_OPTIONS.find((o) => o.value === p);
                                return (
                                    <Chip
                                        key={p}
                                        label={opt?.label ?? p}
                                        size="small"
                                        sx={{ height: 20, fontSize: '0.65rem' }}
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
                                borderRadius: '50%',
                                bgcolor: opt.color,
                                border: opt.color === 'transparent' ? '1px solid' : 'none',
                                borderColor: 'divider',
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
                onChange={(e) => updateFilter('dueDateFrom', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 140 }}
            />
            <TextField
                size="small"
                type="date"
                label="To"
                value={filters.dueDateTo}
                onChange={(e) => updateFilter('dueDateTo', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 140 }}
            />

            {/* Clear all */}
            {activeFilterCount > 0 && (
                <Tooltip title="Clear all filters">
                    <IconButton size="small" onClick={clearAll}>
                        <ClearIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );
}
