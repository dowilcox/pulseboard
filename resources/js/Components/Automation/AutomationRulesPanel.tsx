import axios from "axios";
import type { AutomationRule, Column, Label, User } from "@/types";
import { PRIORITY_OPTIONS } from "@/constants/priorities";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";

const TRIGGER_TYPES = [
    { value: "task_moved", label: "Task moved" },
    { value: "task_created", label: "Task created" },
    { value: "task_completed", label: "Task completed" },
    { value: "task_uncompleted", label: "Task reopened" },
    { value: "task_assigned", label: "Task assigned" },
    { value: "label_added", label: "Label added" },
    { value: "priority_changed", label: "Priority changed" },
    { value: "comment_added", label: "Comment added" },
    { value: "due_date_reached", label: "Due date reached" },
    { value: "gitlab_mr_merged", label: "GitLab MR merged" },
    { value: "gitlab_pipeline_status", label: "GitLab pipeline status" },
];

const ACTION_TYPES = [
    { value: "move_to_column", label: "Move to column" },
    { value: "mark_complete", label: "Mark as complete" },
    { value: "mark_incomplete", label: "Mark as incomplete" },
    { value: "assign_user", label: "Assign user" },
    { value: "unassign_user", label: "Unassign user" },
    { value: "add_label", label: "Add label" },
    { value: "remove_label", label: "Remove label" },
    { value: "update_field", label: "Update field" },
    { value: "send_notification", label: "Send notification" },
];

interface Props {
    teamId: string;
    boardId: string;
    columns: Column[];
    members: User[];
    labels: Label[];
}

interface RuleForm {
    name: string;
    trigger_type: string;
    trigger_config: Record<string, string>;
    action_type: string;
    action_config: Record<string, string>;
}

const EMPTY_FORM: RuleForm = {
    name: "",
    trigger_type: "task_moved",
    trigger_config: {},
    action_type: "move_to_column",
    action_config: {},
};

export default function AutomationRulesPanel({
    teamId,
    boardId,
    columns,
    members,
    labels,
}: Props) {
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const fetchRules = useCallback(() => {
        axios
            .get(route("boards.automation-rules.index", [teamId, boardId]))
            .then(({ data }) => {
                setRules(Array.isArray(data) ? (data as AutomationRule[]) : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [teamId, boardId]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleCreate = () => {
        setSaving(true);
        axios
            .post(
                route("boards.automation-rules.store", [teamId, boardId]),
                form,
            )
            .then(() => {
                setDialogOpen(false);
                setForm(EMPTY_FORM);
                fetchRules();
            })
            .finally(() => setSaving(false));
    };

    const handleToggle = (rule: AutomationRule) => {
        axios
            .put(
                route("boards.automation-rules.update", [
                    teamId,
                    boardId,
                    rule.id,
                ]),
                { is_active: !rule.is_active },
            )
            .then(() => fetchRules());
    };

    const handleDelete = (rule: AutomationRule) => {
        axios
            .delete(
                route("boards.automation-rules.destroy", [
                    teamId,
                    boardId,
                    rule.id,
                ]),
            )
            .then(() => fetchRules());
    };

    const triggerLabel = (type: string) =>
        TRIGGER_TYPES.find((t) => t.value === type)?.label ?? type;
    const actionLabel = (type: string) =>
        ACTION_TYPES.find((a) => a.value === type)?.label ?? type;

    const updateTriggerConfig = (key: string, value: string) =>
        setForm((f) => ({
            ...f,
            trigger_config: { ...f.trigger_config, [key]: value },
        }));

    const updateActionConfig = (key: string, value: string) =>
        setForm((f) => ({
            ...f,
            action_config: { ...f.action_config, [key]: value },
        }));

    // ── Trigger config UI ───────────────────────────────────────────

    const renderTriggerConfig = () => {
        switch (form.trigger_type) {
            case "task_moved":
                return (
                    <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                        <TextField
                            select
                            label="From Column (optional)"
                            fullWidth
                            value={form.trigger_config.from_column_id ?? ""}
                            onChange={(e) =>
                                updateTriggerConfig(
                                    "from_column_id",
                                    e.target.value,
                                )
                            }
                        >
                            <MenuItem value="">Any</MenuItem>
                            {columns.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="To Column (optional)"
                            fullWidth
                            value={form.trigger_config.to_column_id ?? ""}
                            onChange={(e) =>
                                updateTriggerConfig(
                                    "to_column_id",
                                    e.target.value,
                                )
                            }
                        >
                            <MenuItem value="">Any</MenuItem>
                            {columns.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>
                );

            case "task_assigned":
                return (
                    <TextField
                        select
                        label="Specific User (optional)"
                        fullWidth
                        value={form.trigger_config.user_id ?? ""}
                        onChange={(e) =>
                            updateTriggerConfig("user_id", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        <MenuItem value="">Any user</MenuItem>
                        {members.map((m) => (
                            <MenuItem key={m.id} value={m.id}>
                                {m.name}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "label_added":
                return (
                    <TextField
                        select
                        label="Specific Label (optional)"
                        fullWidth
                        value={form.trigger_config.label_id ?? ""}
                        onChange={(e) =>
                            updateTriggerConfig("label_id", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        <MenuItem value="">Any label</MenuItem>
                        {labels.map((l) => (
                            <MenuItem key={l.id} value={l.id}>
                                {l.name}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "priority_changed":
                return (
                    <TextField
                        select
                        label="New Priority (optional)"
                        fullWidth
                        value={form.trigger_config.priority ?? ""}
                        onChange={(e) =>
                            updateTriggerConfig("priority", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        <MenuItem value="">Any priority</MenuItem>
                        {PRIORITY_OPTIONS.map((p) => (
                            <MenuItem key={p.value} value={p.value}>
                                {p.label}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "gitlab_pipeline_status":
                return (
                    <TextField
                        select
                        label="Pipeline Status (optional)"
                        fullWidth
                        value={form.trigger_config.status ?? ""}
                        onChange={(e) =>
                            updateTriggerConfig("status", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        <MenuItem value="">Any status</MenuItem>
                        <MenuItem value="success">Success</MenuItem>
                        <MenuItem value="failed">Failed</MenuItem>
                        <MenuItem value="canceled">Canceled</MenuItem>
                    </TextField>
                );

            default:
                return null;
        }
    };

    // ── Action config UI ────────────────────────────────────────────

    const renderActionConfig = () => {
        switch (form.action_type) {
            case "move_to_column":
                return (
                    <TextField
                        select
                        label="Target Column"
                        fullWidth
                        required
                        value={form.action_config.column_id ?? ""}
                        onChange={(e) =>
                            updateActionConfig("column_id", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        {columns.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                                {c.name}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "assign_user":
                return (
                    <TextField
                        select
                        label="Assign To"
                        fullWidth
                        required
                        value={form.action_config.user_id ?? ""}
                        onChange={(e) =>
                            updateActionConfig("user_id", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        {members.map((m) => (
                            <MenuItem key={m.id} value={m.id}>
                                {m.name}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "unassign_user":
                return (
                    <TextField
                        select
                        label="Unassign User"
                        fullWidth
                        required
                        value={form.action_config.user_id ?? ""}
                        onChange={(e) =>
                            updateActionConfig("user_id", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        {members.map((m) => (
                            <MenuItem key={m.id} value={m.id}>
                                {m.name}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "add_label":
                return (
                    <TextField
                        select
                        label="Label to Add"
                        fullWidth
                        required
                        value={form.action_config.label_id ?? ""}
                        onChange={(e) =>
                            updateActionConfig("label_id", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        {labels.map((l) => (
                            <MenuItem key={l.id} value={l.id}>
                                {l.name}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "remove_label":
                return (
                    <TextField
                        select
                        label="Label to Remove"
                        fullWidth
                        required
                        value={form.action_config.label_id ?? ""}
                        onChange={(e) =>
                            updateActionConfig("label_id", e.target.value)
                        }
                        sx={{ mb: 2 }}
                    >
                        {labels.map((l) => (
                            <MenuItem key={l.id} value={l.id}>
                                {l.name}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case "update_field":
                return (
                    <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                        <TextField
                            select
                            label="Field"
                            fullWidth
                            value={form.action_config.field ?? ""}
                            onChange={(e) =>
                                updateActionConfig("field", e.target.value)
                            }
                        >
                            <MenuItem value="priority">Priority</MenuItem>
                            <MenuItem value="effort_estimate">
                                Effort Estimate
                            </MenuItem>
                            <MenuItem value="due_date">Due Date</MenuItem>
                        </TextField>
                        {form.action_config.field === "priority" ? (
                            <TextField
                                select
                                label="Value"
                                fullWidth
                                value={form.action_config.value ?? ""}
                                onChange={(e) =>
                                    updateActionConfig("value", e.target.value)
                                }
                            >
                                {PRIORITY_OPTIONS.map((p) => (
                                    <MenuItem key={p.value} value={p.value}>
                                        {p.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        ) : (
                            <TextField
                                label="Value"
                                fullWidth
                                value={form.action_config.value ?? ""}
                                onChange={(e) =>
                                    updateActionConfig("value", e.target.value)
                                }
                            />
                        )}
                    </Box>
                );

            case "send_notification":
                return (
                    <>
                        <TextField
                            select
                            label="Notify"
                            fullWidth
                            value={form.action_config.target ?? "assignees"}
                            onChange={(e) =>
                                updateActionConfig("target", e.target.value)
                            }
                            sx={{ mb: 2 }}
                        >
                            <MenuItem value="assignees">All assignees</MenuItem>
                            <MenuItem value="creator">Task creator</MenuItem>
                            {members.map((m) => (
                                <MenuItem key={m.id} value={m.id}>
                                    {m.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Message (optional)"
                            fullWidth
                            value={form.action_config.message ?? ""}
                            onChange={(e) =>
                                updateActionConfig("message", e.target.value)
                            }
                            placeholder="Automation triggered on this task"
                            sx={{ mb: 2 }}
                        />
                    </>
                );

            // mark_complete, mark_incomplete need no config
            default:
                return null;
        }
    };

    return (
        <Card variant="outlined">
            <CardContent>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        mb: 2,
                    }}
                >
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
                    <Typography variant="body2" color="text.secondary">
                        Loading...
                    </Typography>
                ) : rules.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 2 }}
                    >
                        No automation rules configured. Add a rule to automate
                        workflows.
                    </Typography>
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                        }}
                    >
                        {rules.map((rule) => (
                            <Box
                                key={rule.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    p: 1.5,
                                    border: 1,
                                    borderColor: "divider",
                                    borderRadius: 1,
                                    opacity: rule.is_active ? 1 : 0.5,
                                }}
                            >
                                <Switch
                                    size="small"
                                    checked={rule.is_active}
                                    onChange={() => handleToggle(rule)}
                                    inputProps={{
                                        "aria-label": `Enable or disable rule: ${rule.name}`,
                                    }}
                                />
                                <Box sx={{ flex: 1 }}>
                                    <Typography
                                        variant="body2"
                                        fontWeight={500}
                                    >
                                        {rule.name}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        When{" "}
                                        <strong>
                                            {triggerLabel(rule.trigger_type)}
                                        </strong>{" "}
                                        then{" "}
                                        <strong>
                                            {actionLabel(rule.action_type)}
                                        </strong>
                                    </Typography>
                                </Box>
                                <Tooltip title="Delete rule">
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDelete(rule)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ))}
                    </Box>
                )}
            </CardContent>

            {/* Create Rule Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="create-automation-rule-dialog-title"
            >
                <DialogTitle id="create-automation-rule-dialog-title">
                    Create Automation Rule
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Rule Name"
                        fullWidth
                        required
                        value={form.name}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        sx={{ mt: 1, mb: 2 }}
                    />

                    <TextField
                        select
                        label="When..."
                        fullWidth
                        value={form.trigger_type}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                trigger_type: e.target.value,
                                trigger_config: {},
                            }))
                        }
                        sx={{ mb: 2 }}
                    >
                        {TRIGGER_TYPES.map((t) => (
                            <MenuItem key={t.value} value={t.value}>
                                {t.label}
                            </MenuItem>
                        ))}
                    </TextField>

                    {renderTriggerConfig()}

                    <TextField
                        select
                        label="Then..."
                        fullWidth
                        value={form.action_type}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                action_type: e.target.value,
                                action_config: {},
                            }))
                        }
                        sx={{ mb: 2 }}
                    >
                        {ACTION_TYPES.map((a) => (
                            <MenuItem key={a.value} value={a.value}>
                                {a.label}
                            </MenuItem>
                        ))}
                    </TextField>

                    {renderActionConfig()}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
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
