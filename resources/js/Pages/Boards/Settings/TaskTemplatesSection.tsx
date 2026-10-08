import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import { PRIORITY_COLORS, PRIORITY_OPTIONS } from "@/constants/priorities";
import type { TaskTemplate } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useRef } from "react";
import type { useTaskTemplates } from "./useTaskTemplates";

interface TaskTemplatesSectionProps {
    teamName: string;
    canManageTemplates: boolean;
    templates: ReturnType<typeof useTaskTemplates>;
}

export default function TaskTemplatesSection({
    teamName,
    canManageTemplates,
    templates,
}: TaskTemplatesSectionProps) {
    const {
        loadingTemplates,
        loadError,
        savingTaskTemplate,
        showTemplateForm,
        editingTemplate,
        taskTemplates,
        templateFormData,
        templateFormErrors,
        pendingDelete,
        deletingTemplate,
        retryLoad,
        handleSubmitTemplate,
        handleTemplateFieldChange,
        openCreateForm,
        openEditForm,
        resetTemplateForm,
        requestDeleteTemplate,
        cancelDeleteTemplate,
        confirmDeleteTemplate,
    } = templates;

    const nameInputRef = useRef<HTMLInputElement>(null);

    // Move focus into the form when it opens (create or edit).
    useEffect(() => {
        if (showTemplateForm) {
            nameInputRef.current?.focus();
        }
    }, [showTemplateForm, editingTemplate]);

    const priorityLabel = (priority: TaskTemplate["priority"]) =>
        priority.charAt(0).toUpperCase() + priority.slice(1);

    return (
        <Card
            variant="outlined"
            component="section"
            aria-labelledby="task-templates-heading"
        >
            <CardContent>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        mb: 1,
                    }}
                >
                    <Typography
                        id="task-templates-heading"
                        variant="subtitle1"
                        component="h2"
                        fontWeight={600}
                    >
                        Task templates
                    </Typography>
                    {canManageTemplates && !showTemplateForm && (
                        <Button
                            startIcon={<AddIcon />}
                            size="small"
                            onClick={openCreateForm}
                        >
                            Add template
                        </Button>
                    )}
                </Box>

                <Alert
                    severity="info"
                    icon={<InfoOutlinedIcon fontSize="inherit" />}
                    sx={{ mb: 2 }}
                >
                    Task templates are shared by every board in {teamName}.
                    Changes here apply to all of them.
                </Alert>

                {loadingTemplates ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 2 }}
                    >
                        Loading templates…
                    </Typography>
                ) : loadError ? (
                    <Alert
                        severity="error"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={retryLoad}
                            >
                                Retry
                            </Button>
                        }
                    >
                        Couldn’t load task templates.
                    </Alert>
                ) : taskTemplates.length === 0 && !showTemplateForm ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 2 }}
                    >
                        No task templates yet.
                        {canManageTemplates &&
                            " Create one to quickly add pre-configured tasks."}
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
                            gap: 1,
                        }}
                    >
                        {taskTemplates.map((template) => (
                            <Paper
                                component="li"
                                key={template.id}
                                variant="outlined"
                                sx={{
                                    px: 2,
                                    py: 1.5,
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    columnGap: 1.5,
                                    rowGap: 0.5,
                                    borderColor:
                                        editingTemplate?.id === template.id
                                            ? "primary.main"
                                            : undefined,
                                }}
                            >
                                <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
                                    <Typography
                                        variant="body2"
                                        fontWeight={500}
                                        noWrap
                                    >
                                        {template.name}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {[
                                            template.effort_estimate != null
                                                ? `${template.effort_estimate} ${template.effort_estimate === 1 ? "point" : "points"}`
                                                : null,
                                            template.creator
                                                ? `by ${template.creator.name}`
                                                : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </Typography>
                                </Box>
                                {template.priority &&
                                    template.priority !== "none" && (
                                        <Chip
                                            label={priorityLabel(
                                                template.priority,
                                            )}
                                            size="small"
                                            sx={{
                                                bgcolor:
                                                    PRIORITY_COLORS[
                                                        template.priority
                                                    ],
                                                color: "#fff",
                                                fontWeight: 500,
                                                fontSize: "0.7rem",
                                                height: 22,
                                            }}
                                        />
                                    )}
                                {canManageTemplates && (
                                    <Box sx={{ display: "flex" }}>
                                        <Tooltip title="Edit template">
                                            <IconButton
                                                size="small"
                                                aria-label={`Edit template ${template.name}`}
                                                onClick={() =>
                                                    openEditForm(template)
                                                }
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete template">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                aria-label={`Delete template ${template.name}`}
                                                onClick={() =>
                                                    requestDeleteTemplate(
                                                        template,
                                                    )
                                                }
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                )}
                            </Paper>
                        ))}
                    </Box>
                )}

                <Collapse in={canManageTemplates && showTemplateForm}>
                    <Paper
                        variant="outlined"
                        component="form"
                        noValidate
                        onSubmit={(event: React.FormEvent) => {
                            event.preventDefault();
                            handleSubmitTemplate();
                        }}
                        aria-labelledby="task-template-form-heading"
                        sx={{ p: 2, mt: 2 }}
                    >
                        <Typography
                            id="task-template-form-heading"
                            variant="body2"
                            component="h3"
                            fontWeight={600}
                            sx={{ mb: 2 }}
                        >
                            {editingTemplate
                                ? `Edit “${editingTemplate.name}”`
                                : "New task template"}
                        </Typography>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                            }}
                        >
                            <TextField
                                label="Name"
                                size="small"
                                required
                                fullWidth
                                inputRef={nameInputRef}
                                value={templateFormData.name}
                                onChange={(event) =>
                                    handleTemplateFieldChange(
                                        "name",
                                        event.target.value,
                                    )
                                }
                                error={!!templateFormErrors.name}
                                helperText={templateFormErrors.name}
                            />
                            <TextField
                                label="Description"
                                size="small"
                                fullWidth
                                multiline
                                rows={3}
                                value={templateFormData.description_template}
                                onChange={(event) =>
                                    handleTemplateFieldChange(
                                        "description_template",
                                        event.target.value,
                                    )
                                }
                                error={
                                    !!templateFormErrors.description_template
                                }
                                helperText={
                                    templateFormErrors.description_template ??
                                    "Markdown is supported."
                                }
                            />
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 2,
                                    flexWrap: "wrap",
                                }}
                            >
                                <TextField
                                    label="Priority"
                                    size="small"
                                    select
                                    value={templateFormData.priority}
                                    onChange={(event) =>
                                        handleTemplateFieldChange(
                                            "priority",
                                            event.target
                                                .value as TaskTemplate["priority"],
                                        )
                                    }
                                    error={!!templateFormErrors.priority}
                                    helperText={templateFormErrors.priority}
                                    sx={{ flex: "1 1 160px" }}
                                >
                                    {PRIORITY_OPTIONS.map((option) => (
                                        <MenuItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}
                                            >
                                                {option.value !== "none" && (
                                                    <Box
                                                        sx={{
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: "50%",
                                                            bgcolor:
                                                                option.color,
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                )}
                                                {option.label}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    label="Effort (points)"
                                    size="small"
                                    type="number"
                                    placeholder="None"
                                    value={templateFormData.effort_estimate}
                                    onChange={(event) =>
                                        handleTemplateFieldChange(
                                            "effort_estimate",
                                            event.target.value === ""
                                                ? ""
                                                : Math.max(
                                                      0,
                                                      Math.trunc(
                                                          Number(
                                                              event.target
                                                                  .value,
                                                          ),
                                                      ),
                                                  ),
                                        )
                                    }
                                    error={!!templateFormErrors.effort_estimate}
                                    helperText={
                                        templateFormErrors.effort_estimate
                                    }
                                    slotProps={{
                                        htmlInput: {
                                            min: 0,
                                            step: 1,
                                            inputMode: "numeric",
                                        },
                                    }}
                                    sx={{ flex: "1 1 140px" }}
                                />
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="small"
                                    disabled={savingTaskTemplate}
                                >
                                    {savingTaskTemplate
                                        ? "Saving…"
                                        : editingTemplate
                                          ? "Save template"
                                          : "Create template"}
                                </Button>
                                <Button
                                    size="small"
                                    onClick={resetTemplateForm}
                                >
                                    Cancel
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                </Collapse>
            </CardContent>

            <ConfirmDialog
                open={pendingDelete !== null}
                onClose={() => {
                    if (!deletingTemplate) cancelDeleteTemplate();
                }}
                onConfirm={confirmDeleteTemplate}
                title="Delete task template?"
                message={
                    pendingDelete
                        ? `“${pendingDelete.name}” will be removed from every board in ${teamName}. Tasks already created from it aren’t affected.`
                        : ""
                }
                confirmLabel={
                    deletingTemplate ? "Deleting…" : "Delete template"
                }
                confirmColor="error"
            />
        </Card>
    );
}
