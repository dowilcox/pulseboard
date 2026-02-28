import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { Link as InertiaLink } from '@inertiajs/react';
import { useState } from 'react';
import type { Board, Column, Team } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
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
    teams: Team[];
    boards: Board[];
}

export default function BoardSettings({ board, team, teams, boards }: Props) {
    const boardForm = useForm({
        name: board.name,
        description: board.description ?? '',
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

    const handleBoardSave = (e: React.FormEvent) => {
        e.preventDefault();
        boardForm.put(route('teams.boards.update', [team.id, board.id]));
    };

    const handleAddColumn = () => {
        setColumns((prev) => [
            ...prev,
            {
                name: '',
                color: '#9e9e9e',
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
            prev.map((col, i) => (i === index ? { ...col, [field]: value } : col)),
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
            route('teams.boards.columns.sync', [team.id, board.id]),
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
            teams={teams}
            currentTeam={team}
            boards={boards}
            activeBoardId={board.id}
            header={
                <Box>
                    <Breadcrumbs sx={{ mb: 0.5 }}>
                        <Link
                            component={InertiaLink}
                            href={route('teams.index')}
                            underline="hover"
                            color="text.secondary"
                            variant="body2"
                        >
                            Teams
                        </Link>
                        <Link
                            component={InertiaLink}
                            href={route('teams.show', team.id)}
                            underline="hover"
                            color="text.secondary"
                            variant="body2"
                        >
                            {team.name}
                        </Link>
                        <Link
                            component={InertiaLink}
                            href={route('teams.boards.show', [team.id, board.id])}
                            underline="hover"
                            color="text.secondary"
                            variant="body2"
                        >
                            {board.name}
                        </Link>
                        <Typography variant="body2" color="text.primary">
                            Settings
                        </Typography>
                    </Breadcrumbs>
                    <Typography variant="h6" component="h2" fontWeight={600}>
                        Board Settings
                    </Typography>
                </Box>
            }
        >
            <Head title={`Settings - ${board.name}`} />

            <Box sx={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Board details */}
                <Card elevation={1}>
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
                <Card elevation={1}>
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

                                    return (
                                        <Paper
                                            key={column.id ?? `new-${index}`}
                                            variant="outlined"
                                            sx={{ p: 2 }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 2,
                                                }}
                                            >
                                                <DragIndicatorIcon
                                                    sx={{
                                                        color: 'text.disabled',
                                                        mt: 1.5,
                                                        cursor: 'grab',
                                                    }}
                                                />

                                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
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

                                                        <TextField
                                                            label="Color"
                                                            size="small"
                                                            type="color"
                                                            value={column.color}
                                                            onChange={(e) =>
                                                                handleColumnChange(index, 'color', e.target.value)
                                                            }
                                                            sx={{ width: 80 }}
                                                            slotProps={{
                                                                input: {
                                                                    sx: { cursor: 'pointer' },
                                                                },
                                                            }}
                                                        />

                                                        <TextField
                                                            label="WIP Limit"
                                                            size="small"
                                                            type="number"
                                                            value={column.wip_limit}
                                                            onChange={(e) =>
                                                                handleColumnChange(
                                                                    index,
                                                                    'wip_limit',
                                                                    e.target.value === '' ? '' : Number(e.target.value),
                                                                )
                                                            }
                                                            sx={{ width: 100 }}
                                                            slotProps={{
                                                                htmlInput: { min: 0 },
                                                            }}
                                                        />
                                                    </Box>

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
                                                </Box>

                                                <Tooltip title="Remove column">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleRemoveColumn(index)}
                                                        sx={{ mt: 0.5 }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
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
            </Box>
        </AuthenticatedLayout>
    );
}
