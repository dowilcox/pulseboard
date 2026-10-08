import axios from "axios";
import type { AutomationRule, Column, Label, User } from "@/types";
import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import { PRIORITY_OPTIONS } from "@/constants/priorities";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
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
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { describeRule, type RuleSegment } from "./describeRule";

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
    { value: "add_watcher", label: "Add watcher" },
    { value: "remove_watcher", label: "Remove watcher" },
];

/** Config each action starts with, so visible defaults are also submitted. */
const DEFAULT_ACTION_CONFIG: Record<string, Record<string, string>> = {
    send_notification: { target: "assignees" },
};

interface Props {
    teamSlug: string;
    boardSlug: string;
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

/** Stored configs may hold numbers; the form edits everything as strings. */
const toStringConfig = (
    config: Record<string, unknown> | null | undefined,
): Record<string, string> =>
    Object.fromEntries(
        Object.entries(config ?? {})
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => [key, String(value)]),
    );

/** Strip empty-string values from a config object before submission. */
const stripEmpty = (obj: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ""));

/** Flatten a Laravel 422 payload into one message per field. */
function validationErrors(error: unknown): Record<string, string> | null {
    if (!axios.isAxiosError(error) || error.response?.status !== 422) {
        return null;
    }
    const errors = (
        error.response.data as { errors?: Record<string, string[]> }
    )?.errors;
    if (!errors) return null;
    return Object.fromEntries(
        Object.entries(errors).map(([key, messages]) => [key, messages[0]]),
    );
}

function Summary({ segments }: { segments: RuleSegment[] }) {
    return (
        <>
            {segments.map((segment, index) =>
                segment.strong ? (
                    <Box
                        component="strong"
                        key={index}
                        sx={{ color: "text.primary", fontWeight: 600 }}
                    >
                        {segment.text}
                    </Box>
                ) : (
                    <Fragment key={index}>{segment.text}</Fragment>
                ),
            )}
        </>
    );
}

export default function AutomationRulesPanel({
    teamSlug,
    boardSlug,
    columns,
    members,
    labels,
}: Props) {
    const { showSnackbar } = useSnackbar();
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    /** Rule being edited; null while creating. */
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [formMessage, setFormMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<AutomationRule | null>(
        null,
    );
    const savingRef = useRef(false);

    const fetchRules = useCallback(() => {
        setLoadError(false);
        return axios
            .get(route("boards.automation-rules.index", [teamSlug, boardSlug]))
            .then(({ data }) => {
                setRules(Array.isArray(data) ? (data as AutomationRule[]) : []);
            })
            .catch(() => setLoadError(true))
            .finally(() => setLoading(false));
    }, [teamSlug, boardSlug]);

    useEffect(() => {
        void fetchRules();
    }, [fetchRules]);

    const openCreate = () => {
        setEditingRule(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setFormMessage(null);
        setDialogOpen(true);
    };

    const openEdit = (rule: AutomationRule) => {
        setEditingRule(rule);
        setForm({
            name: rule.name,
            trigger_type: rule.trigger_type,
            trigger_config: toStringConfig(rule.trigger_config),
            action_type: rule.action_type,
            action_config: {
                ...(DEFAULT_ACTION_CONFIG[rule.action_type] ?? {}),
                ...toStringConfig(rule.action_config),
            },
        });
        setFormErrors({});
        setFormMessage(null);
        setDialogOpen(true);
    };

    const closeDialog = () => {
        if (saving) return;
        setDialogOpen(false);
    };

    /** Check whether the current action type has all its required config filled in. */
    const isActionConfigValid = (): boolean => {
        const c = form.action_config;
        switch (form.action_type) {
            case "move_to_column":
                return !!c.column_id;
            case "assign_user":
            case "unassign_user":
            case "add_watcher":
            case "remove_watcher":
                return !!c.user_id;
            case "add_label":
            case "remove_label":
                return !!c.label_id;
            case "update_field":
                return !!c.field && c.value !== undefined && c.value !== "";
            // mark_complete, mark_incomplete, send_notification: no required config
            default:
                return true;
        }
    };

    const handleSubmit = () => {
        if (!form.name.trim() || !isActionConfigValid()) return;
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setFormErrors({});
        setFormMessage(null);

        const payload = {
            name: form.name.trim(),
            trigger_type: form.trigger_type,
            trigger_config: stripEmpty(form.trigger_config),
            action_type: form.action_type,
            action_config: stripEmpty(form.action_config),
        };

        const request = editingRule
            ? axios.put(
                  route("boards.automation-rules.update", [
                      teamSlug,
                      boardSlug,
                      editingRule.id,
                  ]),
                  payload,
              )
            : axios.post(
                  route("boards.automation-rules.store", [teamSlug, boardSlug]),
                  payload,
              );

        request
            .then(() => {
                setDialogOpen(false);
                showSnackbar(
                    editingRule
                        ? `Rule “${payload.name}” saved.`
                        : `Rule “${payload.name}” created.`,
                    "success",
                );
                void fetchRules();
            })
            .catch((error) => {
                const errors = validationErrors(error);
                if (errors) {
                    setFormErrors(errors);
                    setFormMessage(
                        "Please fix the highlighted problems and try again.",
                    );
                } else {
                    setFormMessage(
                        "Couldn’t save the rule. Check your connection and try again.",
                    );
                }
            })
            .finally(() => {
                savingRef.current = false;
                setSaving(false);
            });
    };

    const handleToggle = (rule: AutomationRule) => {
        const next = !rule.is_active;
        // Optimistic so the switch responds immediately.
        setRules((prev) =>
            prev.map((r) => (r.id === rule.id ? { ...r, is_active: next } : r)),
        );
        axios
            .put(
                route("boards.automation-rules.update", [
                    teamSlug,
                    boardSlug,
                    rule.id,
                ]),
                { is_active: next },
            )
            .then(() =>
                showSnackbar(
                    `Rule “${rule.name}” turned ${next ? "on" : "off"}.`,
                    "success",
                ),
            )
            .catch(() => {
                setRules((prev) =>
                    prev.map((r) =>
                        r.id === rule.id ? { ...r, is_active: !next } : r,
                    ),
                );
                showSnackbar(`Couldn’t update rule “${rule.name}”.`, "error");
            });
    };

    const handleConfirmDelete = () => {
        const rule = pendingDelete;
        if (!rule) return;
        setPendingDelete(null);
        axios
            .delete(
                route("boards.automation-rules.destroy", [
                    teamSlug,
                    boardSlug,
                    rule.id,
                ]),
            )
            .then(() => {
                setRules((prev) => prev.filter((r) => r.id !== rule.id));
                showSnackbar(`Rule “${rule.name}” deleted.`, "success");
            })
            .catch(() =>
                showSnackbar(`Couldn’t delete rule “${rule.name}”.`, "error"),
            );
    };

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

    /** error/helperText props for a field, keyed like the 422 payload. */
    const fieldError = (key: string, helperText?: string) => ({
        error: !!formErrors[key],
        helperText: formErrors[key] ?? helperText,
    });

    // ── Trigger config UI ───────────────────────────────────────────

    const renderTriggerConfig = () => {
        switch (form.trigger_type) {
            case "task_moved":
                return (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 2,
                            mb: 2,
                        }}
                    >
                        <TextField
                            select
                            label="From column (optional)"
                            fullWidth
                            value={form.trigger_config.from_column_id ?? ""}
                            onChange={(e) =>
                                updateTriggerConfig(
                                    "from_column_id",
                                    e.target.value,
                                )
                            }
                            {...fieldError("trigger_config.from_column_id")}
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
                            label="To column (optional)"
                            fullWidth
                            value={form.trigger_config.to_column_id ?? ""}
                            onChange={(e) =>
                                updateTriggerConfig(
                                    "to_column_id",
                                    e.target.value,
                                )
                            }
                            {...fieldError("trigger_config.to_column_id")}
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
                        label="Assigned to (optional)"
                        fullWidth
                        value={form.trigger_config.user_id ?? ""}
                        onChange={(e) =>
                            updateTriggerConfig("user_id", e.target.value)
                        }
                        {...fieldError("trigger_config.user_id")}
                        sx={{ mb: 2 }}
                    >
                        <MenuItem value="">Anyone</MenuItem>
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
                        label="Label (optional)"
                        fullWidth
                        value={form.trigger_config.label_id ?? ""}
                        onChange={(e) =>
                            updateTriggerConfig("label_id", e.target.value)
                        }
                        {...fieldError("trigger_config.label_id")}
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
                        label="New priority (optional)"
                        fullWidth
                        value={form.trigger_config.priority ?? ""}
                        onChange={(e) =>
                            updateTriggerConfig("priority", e.target.value)
                        }
                        {...fieldError("trigger_config.priority")}
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
                        label="Pipeline status (optional)"
                        fullWidth
                        value={form.trigger_config.status ?? ""}
                        onChange={(e) =>
                            updateTriggerConfig("status", e.target.value)
                        }
                        {...fieldError("trigger_config.status")}
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

    const renderMemberSelect = (label: string) => (
        <TextField
            select
            label={label}
            fullWidth
            required
            value={form.action_config.user_id ?? ""}
            onChange={(e) => updateActionConfig("user_id", e.target.value)}
            {...fieldError("action_config.user_id")}
            sx={{ mb: 2 }}
        >
            {members.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                    {m.name}
                </MenuItem>
            ))}
        </TextField>
    );

    const renderLabelSelect = (label: string) => (
        <TextField
            select
            label={label}
            fullWidth
            required
            value={form.action_config.label_id ?? ""}
            onChange={(e) => updateActionConfig("label_id", e.target.value)}
            {...fieldError("action_config.label_id")}
            sx={{ mb: 2 }}
        >
            {labels.map((l) => (
                <MenuItem key={l.id} value={l.id}>
                    {l.name}
                </MenuItem>
            ))}
        </TextField>
    );

    const renderUpdateFieldValue = () => {
        const valueProps = {
            label: "Value",
            fullWidth: true,
            required: true,
            value: form.action_config.value ?? "",
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                updateActionConfig("value", e.target.value),
            ...fieldError("action_config.value"),
        };

        switch (form.action_config.field) {
            case "priority":
                return (
                    <TextField select {...valueProps}>
                        {PRIORITY_OPTIONS.map((p) => (
                            <MenuItem key={p.value} value={p.value}>
                                {p.label}
                            </MenuItem>
                        ))}
                    </TextField>
                );
            case "effort_estimate":
                return (
                    <TextField
                        {...valueProps}
                        label="Points"
                        type="number"
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 1,
                                inputMode: "numeric",
                            },
                        }}
                    />
                );
            case "due_date":
                return (
                    <TextField
                        {...valueProps}
                        label="Date"
                        type="date"
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                );
            default:
                return <TextField {...valueProps} disabled />;
        }
    };

    const renderActionConfig = () => {
        switch (form.action_type) {
            case "move_to_column":
                return (
                    <TextField
                        select
                        label="Target column"
                        fullWidth
                        required
                        value={form.action_config.column_id ?? ""}
                        onChange={(e) =>
                            updateActionConfig("column_id", e.target.value)
                        }
                        {...fieldError("action_config.column_id")}
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
                return renderMemberSelect("Assign to");
            case "unassign_user":
                return renderMemberSelect("Unassign user");
            case "add_watcher":
                return renderMemberSelect("Add watcher");
            case "remove_watcher":
                return renderMemberSelect("Remove watcher");
            case "add_label":
                return renderLabelSelect("Label to add");
            case "remove_label":
                return renderLabelSelect("Label to remove");

            case "update_field":
                return (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 2,
                            mb: 2,
                        }}
                    >
                        <TextField
                            select
                            label="Field"
                            fullWidth
                            required
                            value={form.action_config.field ?? ""}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    // A new field needs a new kind of value.
                                    action_config: { field: e.target.value },
                                }))
                            }
                            {...fieldError("action_config.field")}
                        >
                            <MenuItem value="priority">Priority</MenuItem>
                            <MenuItem value="effort_estimate">
                                Effort (points)
                            </MenuItem>
                            <MenuItem value="due_date">Due date</MenuItem>
                        </TextField>
                        {renderUpdateFieldValue()}
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
                            {...fieldError("action_config.target")}
                            sx={{ mb: 2 }}
                        >
                            <MenuItem value="assignees">All assignees</MenuItem>
                            <MenuItem value="watchers">All watchers</MenuItem>
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
                            {...fieldError("action_config.message")}
                            sx={{ mb: 2 }}
                        />
                    </>
                );

            // mark_complete, mark_incomplete need no config
            default:
                return null;
        }
    };

    const lookups = { columns, members, labels };
    const preview = describeRule(form, lookups);

    return (
        <Card
            variant="outlined"
            component="section"
            aria-labelledby="automation-rules-heading"
        >
            <CardContent>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        mb: 0.5,
                    }}
                >
                    <Typography
                        id="automation-rules-heading"
                        variant="subtitle1"
                        component="h2"
                        fontWeight={600}
                    >
                        Automation rules
                    </Typography>
                    <Button
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={openCreate}
                    >
                        Add rule
                    </Button>
                </Box>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    Rules run automatically when tasks on this board change.
                </Typography>

                {loading ? (
                    <Typography variant="body2" color="text.secondary">
                        Loading rules…
                    </Typography>
                ) : loadError ? (
                    <Alert
                        severity="error"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => void fetchRules()}
                            >
                                Retry
                            </Button>
                        }
                    >
                        Couldn’t load automation rules.
                    </Alert>
                ) : rules.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 2 }}
                    >
                        No automation rules yet. Add a rule to automate routine
                        work.
                    </Typography>
                ) : (
                    <Box
                        component="ul"
                        sx={{
                            listStyle: "none",
                            p: 0,
                            m: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                        }}
                    >
                        {rules.map((rule) => {
                            const summary = describeRule(rule, lookups);
                            return (
                                <Box
                                    component="li"
                                    key={rule.id}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        p: 1.5,
                                        border: 1,
                                        borderColor: "divider",
                                        borderRadius: 1,
                                    }}
                                >
                                    <Switch
                                        size="small"
                                        checked={rule.is_active}
                                        onChange={() => handleToggle(rule)}
                                        slotProps={{
                                            input: {
                                                "aria-label": `Enable rule “${rule.name}”`,
                                            },
                                        }}
                                    />
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            opacity: rule.is_active ? 1 : 0.65,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            fontWeight={500}
                                        >
                                            {rule.name}
                                            {!rule.is_active && (
                                                <Typography
                                                    component="span"
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ ml: 1 }}
                                                >
                                                    Off
                                                </Typography>
                                            )}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            When{" "}
                                            <Summary
                                                segments={summary.trigger}
                                            />{" "}
                                            <span aria-hidden="true">→</span>
                                            <Box
                                                component="span"
                                                sx={{
                                                    position: "absolute",
                                                    width: 1,
                                                    height: 1,
                                                    overflow: "hidden",
                                                    clip: "rect(0 0 0 0)",
                                                }}
                                            >
                                                , then
                                            </Box>{" "}
                                            <Summary
                                                segments={summary.action}
                                            />
                                        </Typography>
                                    </Box>
                                    <Tooltip title="Edit rule">
                                        <IconButton
                                            size="small"
                                            onClick={() => openEdit(rule)}
                                            aria-label={`Edit rule ${rule.name}`}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete rule">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() =>
                                                setPendingDelete(rule)
                                            }
                                            aria-label={`Delete rule ${rule.name}`}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </CardContent>

            {/* Create / edit rule dialog */}
            <Dialog
                open={dialogOpen}
                onClose={closeDialog}
                maxWidth="sm"
                fullWidth
                aria-labelledby="automation-rule-dialog-title"
            >
                <Box
                    component="form"
                    noValidate
                    onSubmit={(event: React.FormEvent) => {
                        event.preventDefault();
                        handleSubmit();
                    }}
                >
                    <DialogTitle id="automation-rule-dialog-title">
                        {editingRule
                            ? "Edit automation rule"
                            : "Create automation rule"}
                    </DialogTitle>
                    <DialogContent>
                        {formMessage && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {formMessage}
                                {Object.keys(formErrors).length > 0 && (
                                    <Box
                                        component="ul"
                                        sx={{ m: 0, mt: 0.5, pl: 2 }}
                                    >
                                        {Object.entries(formErrors).map(
                                            ([key, message]) => (
                                                <li key={key}>{message}</li>
                                            ),
                                        )}
                                    </Box>
                                )}
                            </Alert>
                        )}

                        <TextField
                            autoFocus
                            label="Rule name"
                            fullWidth
                            required
                            value={form.name}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, name: e.target.value }))
                            }
                            {...fieldError("name")}
                            sx={{ mt: 1, mb: 2 }}
                        />

                        <TextField
                            select
                            label="When…"
                            fullWidth
                            value={form.trigger_type}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    trigger_type: e.target.value,
                                    trigger_config: {},
                                }))
                            }
                            {...fieldError("trigger_type")}
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
                            label="Then…"
                            fullWidth
                            value={form.action_type}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    action_type: e.target.value,
                                    action_config: {
                                        ...(DEFAULT_ACTION_CONFIG[
                                            e.target.value
                                        ] ?? {}),
                                    },
                                }))
                            }
                            {...fieldError("action_type")}
                            sx={{ mb: 2 }}
                        >
                            {ACTION_TYPES.map((a) => (
                                <MenuItem key={a.value} value={a.value}>
                                    {a.label}
                                </MenuItem>
                            ))}
                        </TextField>

                        {renderActionConfig()}

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            aria-live="polite"
                        >
                            When <Summary segments={preview.trigger} />, then{" "}
                            <Summary segments={preview.action} />.
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={closeDialog} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={
                                saving ||
                                !form.name.trim() ||
                                !isActionConfigValid()
                            }
                        >
                            {saving
                                ? "Saving…"
                                : editingRule
                                  ? "Save rule"
                                  : "Create rule"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <ConfirmDialog
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete automation rule?"
                message={
                    pendingDelete
                        ? `“${pendingDelete.name}” will stop running and be removed from this board. This can’t be undone.`
                        : ""
                }
                confirmLabel="Delete rule"
                confirmColor="error"
            />
        </Card>
    );
}
