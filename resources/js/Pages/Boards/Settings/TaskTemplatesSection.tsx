import { PRIORITY_COLORS, PRIORITY_OPTIONS } from "@/constants/priorities";
import type { TaskTemplate } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
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
import type { TaskTemplateFormData } from "./types";

interface TaskTemplatesSectionProps {
    loadingTemplates: boolean;
    savingTaskTemplate: boolean;
    showTemplateForm: boolean;
    taskTemplates: TaskTemplate[];
    templateFormData: TaskTemplateFormData;
    templateFormErrors: Record<string, string>;
    onCreateTaskTemplate: () => void;
    onDeleteTaskTemplate: (templateId: string) => void;
    onTemplateFieldChange: <Field extends keyof TaskTemplateFormData>(
        field: Field,
        value: TaskTemplateFormData[Field],
    ) => void;
    onOpenTemplateForm: () => void;
    onResetTemplateForm: () => void;
}

export default function TaskTemplatesSection({
    loadingTemplates,
    savingTaskTemplate,
    showTemplateForm,
    taskTemplates,
    templateFormData,
    templateFormErrors,
    onCreateTaskTemplate,
    onDeleteTaskTemplate,
    onTemplateFieldChange,
    onOpenTemplateForm,
    onResetTemplateForm,
}: TaskTemplatesSectionProps) {
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
                        Task Templates
                    </Typography>
                    {!showTemplateForm && (
                        <Button
                            startIcon={<AddIcon />}
                            size="small"
                            onClick={onOpenTemplateForm}
                        >
                            Add Template
                        </Button>
                    )}
                </Box>

                {loadingTemplates ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 2 }}
                    >
                        Loading templates...
                    </Typography>
                ) : taskTemplates.length === 0 && !showTemplateForm ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 2 }}
                    >
                        No task templates yet. Create one to quickly add
                        pre-configured tasks.
                    </Typography>
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                        }}
                    >
                        {taskTemplates.map((template) => (
                            <Paper
                                key={template.id}
                                variant="outlined"
                                sx={{ px: 2, py: 1.5 }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        fontWeight={500}
                                        sx={{ flex: 1 }}
                                    >
                                        {template.name}
                                    </Typography>
                                    {template.priority &&
                                        template.priority !== "none" && (
                                            <Chip
                                                label={
                                                    template.priority
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                    template.priority.slice(1)
                                                }
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
                                    {template.creator && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            by {template.creator.name}
                                        </Typography>
                                    )}
                                    <Tooltip title="Delete template">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() =>
                                                onDeleteTaskTemplate(
                                                    template.id,
                                                )
                                            }
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}

                <Collapse in={showTemplateForm}>
                    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                        <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ mb: 2 }}
                        >
                            New Task Template
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
                                value={templateFormData.name}
                                onChange={(event) =>
                                    onTemplateFieldChange(
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
                                    onTemplateFieldChange(
                                        "description_template",
                                        event.target.value,
                                    )
                                }
                                error={
                                    !!templateFormErrors.description_template
                                }
                                helperText={
                                    templateFormErrors.description_template
                                }
                            />
                            <Box sx={{ display: "flex", gap: 2 }}>
                                <TextField
                                    label="Priority"
                                    size="small"
                                    select
                                    value={templateFormData.priority}
                                    onChange={(event) =>
                                        onTemplateFieldChange(
                                            "priority",
                                            event.target
                                                .value as TaskTemplate["priority"],
                                        )
                                    }
                                    sx={{ minWidth: 160 }}
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
                                    label="Effort Estimate"
                                    size="small"
                                    type="number"
                                    placeholder="Hours"
                                    value={templateFormData.effort_estimate}
                                    onChange={(event) =>
                                        onTemplateFieldChange(
                                            "effort_estimate",
                                            event.target.value === ""
                                                ? ""
                                                : Number(event.target.value),
                                        )
                                    }
                                    error={!!templateFormErrors.effort_estimate}
                                    helperText={
                                        templateFormErrors.effort_estimate
                                    }
                                    slotProps={{
                                        htmlInput: {
                                            min: 0,
                                            step: 0.5,
                                        },
                                    }}
                                    sx={{ width: 160 }}
                                />
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={onCreateTaskTemplate}
                                    disabled={savingTaskTemplate}
                                >
                                    {savingTaskTemplate ? "Saving..." : "Save"}
                                </Button>
                                <Button
                                    size="small"
                                    onClick={onResetTemplateForm}
                                >
                                    Cancel
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                </Collapse>
            </CardContent>
        </Card>
    );
}
