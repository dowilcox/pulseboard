import type { AutomationRule, Column, User } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';

const TRIGGER_TYPES = [
    { value: 'task_moved', label: 'Task moved' },
    { value: 'task_created', label: 'Task created' },
    { value: 'task_assigned', label: 'Task assigned' },
    { value: 'label_added', label: 'Label added' },
    { value: 'due_date_reached', label: 'Due date reached' },
    { value: 'gitlab_mr_merged', label: 'GitLab MR merged' },
    { value: 'gitlab_pipeline_status', label: 'GitLab pipeline status' },
];

const ACTION_TYPES = [
    { value: 'move_to_column', label: 'Move to column' },
    { value: 'assign_user', label: 'Assign user' },
    { value: 'add_label', label: 'Add label' },
    { value: 'update_field', label: 'Update field' },
];

interface Props {
    teamId: string;
    boardId: string;
    columns: Column[];
    members: User[];
}

interface RuleForm {
    name: string;
    trigger_type: string;
    trigger_config: Record<string, string>;
    action_type: string;
    action_config: Record<string, string>;
}

const EMPTY_FORM: RuleForm = {
    name: '',
    trigger_type: 'task_moved',
    trigger_config: {},
    action_type: 'move_to_column',
    action_config: {},
};

export default function AutomationRulesPanel({ teamId, boardId, columns, members }: Props) {
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const fetchRules = useCallback(() => {
        fetch(route('boards.automation-rules.index', [teamId, boardId]), {
            headers: { Accept: 'application/json' },
        })
            .then((res) => res.json())
            .then((data: AutomationRule[]) => {
                setRules(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [teamId, boardId]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleCreate = () => {
        setSaving(true);
        fetch(route('boards.automation-rules.store', [teamId, boardId]), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
            },
            body: JSON.stringify(form),
        })
            .then((res) => res.json())
            .then(() => {
                setDialogOpen(false);
                setForm(EMPTY_FORM);
                fetchRules();
            })
            .finally(() => setSaving(false));
    };

    const handleToggle = (rule: AutomationRule) => {
        fetch(route('boards.automation-rules.update', [teamId, boardId, rule.id]), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
            },
            body: JSON.stringify({ is_active: !rule.is_active }),
        }).then(() => fetchRules());
    };

    const handleDelete = (rule: AutomationRule) => {
        fetch(route('boards.automation-rules.destroy', [teamId, boardId, rule.id]), {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
            },
        }).then(() => fetchRules());
    };

    const triggerLabel = (type: string) => TRIGGER_TYPES.find((t) => t.value === type)?.label ?? type;
    const actionLabel = (type: string) => ACTION_TYPES.find((a) => a.value === type)?.label ?? type;

    return (
        <Card elevation={1}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                        Automation Rules
                    </Typography>
                    <Button
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={() => setDialogOpen(true)}
                    >
                        Add Rule
                    </Button>
                </Box>

                {loading ? (
                    <Typography variant="body2" color="text.secondary">Loading...</Typography>
                ) : rules.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No automation rules configured. Add a rule to automate workflows.
                    </Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {rules.map((rule) => (
                            <Box
                                key={rule.id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    p: 1.5,
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    opacity: rule.is_active ? 1 : 0.5,
                                }}
                            >
                                <Switch
                                    size="small"
                                    checked={rule.is_active}
                                    onChange={() => handleToggle(rule)}
                                    inputProps={{ 'aria-label': `Enable or disable rule: ${rule.name}` }}
                                />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" fontWeight={500}>
                                        {rule.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        When <strong>{triggerLabel(rule.trigger_type)}</strong> then{' '}
                                        <strong>{actionLabel(rule.action_type)}</strong>
                                    </Typography>
                                </Box>
                                <Tooltip title="Delete rule">
                                    <IconButton size="small" color="error" onClick={() => handleDelete(rule)}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ))}
                    </Box>
                )}
            </CardContent>

            {/* Create Rule Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Automation Rule</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Rule Name"
                        fullWidth
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        sx={{ mt: 1, mb: 2 }}
                    />

                    <TextField
                        select
                        label="When..."
                        fullWidth
                        value={form.trigger_type}
                        onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value, trigger_config: {} }))}
                        sx={{ mb: 2 }}
                    >
                        {TRIGGER_TYPES.map((t) => (
                            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                        ))}
                    </TextField>

                    {/* Trigger config - column selector for task_moved */}
                    {form.trigger_type === 'task_moved' && (
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            <TextField
                                select
                                label="From Column (optional)"
                                fullWidth
                                value={form.trigger_config.from_column_id ?? ''}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        trigger_config: { ...f.trigger_config, from_column_id: e.target.value },
                                    }))
                                }
                            >
                                <MenuItem value="">Any</MenuItem>
                                {columns.map((c) => (
                                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                label="To Column (optional)"
                                fullWidth
                                value={form.trigger_config.to_column_id ?? ''}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        trigger_config: { ...f.trigger_config, to_column_id: e.target.value },
                                    }))
                                }
                            >
                                <MenuItem value="">Any</MenuItem>
                                {columns.map((c) => (
                                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                ))}
                            </TextField>
                        </Box>
                    )}

                    <TextField
                        select
                        label="Then..."
                        fullWidth
                        value={form.action_type}
                        onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value, action_config: {} }))}
                        sx={{ mb: 2 }}
                    >
                        {ACTION_TYPES.map((a) => (
                            <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                        ))}
                    </TextField>

                    {/* Action config - column selector for move_to_column */}
                    {form.action_type === 'move_to_column' && (
                        <TextField
                            select
                            label="Target Column"
                            fullWidth
                            required
                            value={form.action_config.column_id ?? ''}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    action_config: { ...f.action_config, column_id: e.target.value },
                                }))
                            }
                            sx={{ mb: 2 }}
                        >
                            {columns.map((c) => (
                                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                            ))}
                        </TextField>
                    )}

                    {/* Action config - user selector for assign_user */}
                    {form.action_type === 'assign_user' && (
                        <TextField
                            select
                            label="Assign To"
                            fullWidth
                            required
                            value={form.action_config.user_id ?? ''}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    action_config: { ...f.action_config, user_id: e.target.value },
                                }))
                            }
                            sx={{ mb: 2 }}
                        >
                            {members.map((m) => (
                                <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                            ))}
                        </TextField>
                    )}

                    {/* Action config - field update */}
                    {form.action_type === 'update_field' && (
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            <TextField
                                select
                                label="Field"
                                fullWidth
                                value={form.action_config.field ?? ''}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        action_config: { ...f.action_config, field: e.target.value },
                                    }))
                                }
                            >
                                <MenuItem value="priority">Priority</MenuItem>
                                <MenuItem value="effort_estimate">Effort Estimate</MenuItem>
                            </TextField>
                            <TextField
                                label="Value"
                                fullWidth
                                value={form.action_config.value ?? ''}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        action_config: { ...f.action_config, value: e.target.value },
                                    }))
                                }
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreate}
                        disabled={saving || !form.name}
                    >
                        Create Rule
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
}
