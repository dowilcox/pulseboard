import AutomationRulesPanel from '@/Components/Automation/AutomationRulesPanel';
import ColorSwatchPicker from '@/Components/Common/ColorSwatchPicker';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import type { Board, Column, Team, User } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface ColumnFormData {
    id?: string;
    name: string;
    color: string;
    wip_limit: number | '';
    is_done_column: boolean;
    _destroy?: boolean;
}

interface Props {
    board: Board;
    team: Team;
    members: User[];
}

export default function BoardSettings({ board, team, members }: Props) {
    const boardForm = useForm({
        name: board.name,
        description: board.description ?? '',
        settings: {
            auto_move_to_done: board.settings?.auto_move_to_done ?? false,
        },
    });

    const initialColumns: ColumnFormData[] = (board.columns ?? []).map((col) => ({
        id: col.id,
        name: col.name,
        color: col.color,
        wip_limit: col.wip_limit ?? '',
        is_done_column: col.is_done_column,
    }));

    const [columns, setColumns] = useState<ColumnFormData[]>(initialColumns);
    const [columnErrors, setColumnErrors] = useState<Record<string, string>>({});
    const [savingColumns, setSavingColumns] = useState(false);
    const [expandedColumn, setExpandedColumn] = useState<number | null>(null);

    const handleBoardSave = (e: React.FormEvent) => {
        e.preventDefault();
        boardForm.put(route('teams.boards.update', [team.id, board.id]));
    };

    const handleAddColumn = () => {
        setColumns((prev) => [
            ...prev,
            {
                name: '',
                color: '#64748b',
                wip_limit: '',
                is_done_column: false,
            },
        ]);
    };

    const handleColumnChange = (
        index: number,
        field: keyof ColumnFormData,
        value: string | number | boolean | '',
    ) => {
        setColumns((prev) =>
            prev.map((col, i) => {
                if (i === index) {
                    return { ...col, [field]: value };
                }
                if (field === 'is_done_column' && value === true) {
                    return { ...col, is_done_column: false };
                }
                return col;
            }),
        );
    };

    const handleRemoveColumn = (index: number) => {
        setColumns((prev) => {
            const col = prev[index];
            if (col.id) {
                // Mark existing column for deletion
                return prev.map((c, i) =>
                    i === index ? { ...c, _destroy: true } : c,
                );
            }
            // Remove new unsaved column
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
        setColumns((prev) => {
            const next = [...prev];
            // Find the actual visible indices (skip _destroy items)
            const visibleIndices = next.reduce<number[]>((acc, col, i) => {
                if (!col._destroy) acc.push(i);
                return acc;
            }, []);
            const visiblePos = visibleIndices.indexOf(index);
            const swapVisiblePos = direction === 'up' ? visiblePos - 1 : visiblePos + 1;
            if (swapVisiblePos < 0 || swapVisiblePos >= visibleIndices.length) return prev;
            const swapIndex = visibleIndices[swapVisiblePos];
            [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
            return next;
        });
    };

    const handleSaveColumns = () => {
        setSavingColumns(true);
        setColumnErrors({});

        const payload = columns.map((col, index) => ({
            id: col.id,
            name: col.name,
            color: col.color,
            wip_limit: col.wip_limit === '' ? null : Number(col.wip_limit),
            is_done_column: col.is_done_column,
            sort_order: index,
            _destroy: col._destroy ?? false,
        }));

        router.put(
            route('teams.boards.columns.reorder', [team.id, board.id]),
            { columns: payload },
            {
                onSuccess: () => setSavingColumns(false),
                onError: (errors) => {
                    setColumnErrors(errors as Record<string, string>);
                    setSavingColumns(false);
                },
            },
        );
    };

    const visibleColumns = columns.filter((c) => !c._destroy);

    return (
        <AuthenticatedLayout
            currentTeam={team}
            activeBoardId={board.id}
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    {board.name} Settings
                </Typography>
            }
        >
            <Head title={`Settings - ${board.name}`} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Board details */}
                <Card variant="outlined">
                    <CardContent>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Board Details
                        </Typography>
                        <form onSubmit={handleBoardSave}>
                            <TextField
                                label="Board Name"
                                fullWidth
                                required
                                value={boardForm.data.name}
                                onChange={(e) => boardForm.setData('name', e.target.value)}
                                error={!!boardForm.errors.name}
                                helperText={boardForm.errors.name}
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                label="Description"
                                fullWidth
                                multiline
                                rows={3}
                                value={boardForm.data.description}
                                onChange={(e) => boardForm.setData('description', e.target.value)}
                                error={!!boardForm.errors.description}
                                helperText={boardForm.errors.description}
                                sx={{ mb: 2 }}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={boardForm.data.settings.auto_move_to_done}
                                        onChange={(e) =>
                                            boardForm.setData('settings', {
                                                ...boardForm.data.settings,
                                                auto_move_to_done: e.target.checked,
                                            })
                                        }
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        Auto-move tasks to Done column when completed
                                    </Typography>
                                }
                                sx={{ mb: 2 }}
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={boardForm.processing}
                            >
                                Save Details
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Column management */}
                <Card variant="outlined">
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                Columns
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                size="small"
                                onClick={handleAddColumn}
                            >
                                Add Column
                            </Button>
                        </Box>

                        {columnErrors['columns'] && (
                            <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                                {columnErrors['columns']}
                            </Typography>
                        )}

                        {visibleColumns.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                No columns configured. Add a column to get started.
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {columns.map((column, index) => {
                                    if (column._destroy) return null;
                                    const visibleIndex = visibleColumns.indexOf(column);
                                    const isFirst = visibleIndex === 0;
                                    const isLast = visibleIndex === visibleColumns.length - 1;

                                    return (
                                        <Paper
                                            key={column.id ?? `new-${index}`}
                                            variant="outlined"
                                            sx={{ p: 2 }}
                                        >
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                {/* Row 1: Name + color + delete */}
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1.5,
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                                        <IconButton
                                                            size="small"
                                                            disabled={isFirst}
                                                            onClick={() => handleMoveColumn(index, 'up')}
                                                            aria-label="Move column up"
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <KeyboardArrowUpIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            disabled={isLast}
                                                            onClick={() => handleMoveColumn(index, 'down')}
                                                            aria-label="Move column down"
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <KeyboardArrowDownIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>

                                                    <Tooltip title="Click to change color">
                                                        <Box
                                                            component="button"
                                                            type="button"
                                                            onClick={() =>
                                                                setExpandedColumn(
                                                                    expandedColumn === index ? null : index,
                                                                )
                                                            }
                                                            sx={{
                                                                width: 24,
                                                                height: 24,
                                                                borderRadius: '50%',
                                                                bgcolor: column.color,
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                p: 0,
                                                                flexShrink: 0,
                                                                transition: 'box-shadow 0.15s',
                                                                '&:hover': {
                                                                    boxShadow: '0 0 0 3px rgba(255,255,255,0.2)',
                                                                },
                                                            }}
                                                        />
                                                    </Tooltip>

                                                    <TextField
                                                        label="Name"
                                                        size="small"
                                                        required
                                                        value={column.name}
                                                        onChange={(e) =>
                                                            handleColumnChange(index, 'name', e.target.value)
                                                        }
                                                        error={!!columnErrors[`columns.${index}.name`]}
                                                        helperText={columnErrors[`columns.${index}.name`]}
                                                        sx={{ flex: 1 }}
                                                    />

                                                    <Tooltip title="Remove column">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleRemoveColumn(index)}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>

                                                {/* Collapsible color picker */}
                                                <Collapse in={expandedColumn === index}>
                                                    <Box sx={{ pl: 0 }}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                                            Color
                                                        </Typography>
                                                        <ColorSwatchPicker
                                                            value={column.color}
                                                            onChange={(color) =>
                                                                handleColumnChange(index, 'color', color)
                                                            }
                                                        />
                                                    </Box>
                                                </Collapse>

                                                {/* Row 2: WIP limit + Done checkbox */}
                                                <Box
                                                    sx={{
                                                        pl: 0,
                                                        display: 'flex',
                                                        gap: 3,
                                                        alignItems: 'flex-start',
                                                    }}
                                                >
                                                    <Box sx={{ flex: 1 }}>
                                                        <TextField
                                                            label="WIP Limit"
                                                            size="small"
                                                            type="number"
                                                            placeholder="No limit"
                                                            fullWidth
                                                            value={column.wip_limit}
                                                            onChange={(e) =>
                                                                handleColumnChange(
                                                                    index,
                                                                    'wip_limit',
                                                                    e.target.value === '' ? '' : Number(e.target.value),
                                                                )
                                                            }
                                                            helperText="Max tasks allowed in this column"
                                                            slotProps={{
                                                                htmlInput: { min: 1 },
                                                            }}
                                                        />
                                                    </Box>

                                                    <Box sx={{ flex: 1, pt: 0.5 }}>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={column.is_done_column}
                                                                    onChange={(e) =>
                                                                        handleColumnChange(
                                                                            index,
                                                                            'is_done_column',
                                                                            e.target.checked,
                                                                        )
                                                                    }
                                                                    size="small"
                                                                />
                                                            }
                                                            label={
                                                                <Typography variant="body2">
                                                                    Mark as "Done" column
                                                                </Typography>
                                                            }
                                                        />
                                                        <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5, display: 'block' }}>
                                                            Tasks moved here are considered complete
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Paper>
                                    );
                                })}
                            </Box>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Button
                            variant="contained"
                            onClick={handleSaveColumns}
                            disabled={savingColumns}
                        >
                            Save Columns
                        </Button>
                    </CardContent>
                </Card>

                {/* Automation Rules */}
                <AutomationRulesPanel
                    teamId={team.id}
                    boardId={board.id}
                    columns={board.columns ?? []}
                    members={members}
                />
            </Box>
        </AuthenticatedLayout>
    );
}
