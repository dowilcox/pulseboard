import { PRIORITY_OPTIONS } from "@/constants/priorities";
import { harbor, harborAvatarColor } from "@/theme/harbor";
import type { Column, Label, Task, User } from "@/types";
import { getTaskLabel } from "@/utils/gitlabPrefix";
import { toDateInputValue } from "@/utils/taskFields";
import FlagIcon from "@mui/icons-material/Flag";
import Autocomplete, {
    autocompleteClasses,
    type AutocompleteCloseReason,
} from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Popover from "@mui/material/Popover";
import type { PopperProps } from "@mui/material/Popper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { type ReactNode, useEffect, useId, useState } from "react";

export type PickerKind = "assignees" | "labels" | "priority" | "due" | "move";

/** Keys that set a priority directly (also shown in the priority picker). */
export const PRIORITY_KEYS: Record<string, Task["priority"]> = {
    "1": "urgent",
    "2": "high",
    "3": "medium",
    "4": "low",
    "0": "none",
};

const PRIORITY_KEY_BY_VALUE = Object.fromEntries(
    Object.entries(PRIORITY_KEYS).map(([key, value]) => [value, key]),
);

export interface TaskQuickPickerProps {
    kind: PickerKind | null;
    task: Task | null;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    members: User[];
    labels: Label[];
    columns: Column[];
    isColumnFull: (column: Column) => boolean;
    onAssigneesChange: (task: Task, userIds: string[]) => void;
    onLabelsChange: (task: Task, labelIds: string[]) => void;
    onPriorityChange: (task: Task, priority: Task["priority"]) => void;
    onDueDateChange: (task: Task, dueDate: string | null) => void;
    onMove: (task: Task, columnId: string) => void;
}

/**
 * Inline list for a picker that is always open: the Autocomplete's listbox
 * renders in the popover instead of a floating popper (the GitHub label
 * picker pattern from the MUI docs).
 */
function InlinePopper(props: PopperProps) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { disablePortal, anchorEl, open, ...other } = props;
    return (
        <Box
            {...(other as object)}
            sx={{
                [`& .${autocompleteClasses.paper}`]: {
                    boxShadow: "none",
                    m: 0,
                    borderRadius: 0,
                },
                [`& .${autocompleteClasses.listbox}`]: {
                    maxHeight: 280,
                    py: 0.5,
                },
            }}
        />
    );
}

const TITLE_SX = {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: harbor.faint,
    px: 1.5,
    pt: 1.25,
    pb: 0.75,
} as const;

/**
 * Keyboard-opened pickers for the focused board card: assignees, labels,
 * priority, due date and "move to column". Anchored to the card; Esc closes
 * and focus returns to the card.
 */
export default function TaskQuickPicker({
    kind,
    task,
    anchorEl,
    onClose,
    ...rest
}: TaskQuickPickerProps) {
    const titleId = useId();
    const open = kind !== null && task !== null;

    return (
        <Popover
            open={open}
            onClose={onClose}
            anchorEl={anchorEl}
            anchorReference={anchorEl ? "anchorEl" : "anchorPosition"}
            anchorPosition={{
                top: typeof window === "undefined" ? 0 : window.innerHeight / 3,
                left: typeof window === "undefined" ? 0 : window.innerWidth / 2,
            }}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            slotProps={{
                paper: {
                    role: "dialog",
                    "aria-labelledby": titleId,
                    sx: { width: 300, maxWidth: "calc(100vw - 32px)" },
                } as object,
            }}
        >
            {open && (
                <PickerBody
                    key={`${kind}:${task.id}`}
                    kind={kind}
                    task={task}
                    titleId={titleId}
                    onClose={onClose}
                    {...rest}
                />
            )}
        </Popover>
    );
}

type BodyProps = Omit<TaskQuickPickerProps, "kind" | "task" | "anchorEl"> & {
    kind: PickerKind;
    task: Task;
    titleId: string;
};

function PickerTitle({ id, children }: { id: string; children: ReactNode }) {
    return (
        <Typography id={id} component="h2" sx={TITLE_SX}>
            {children}
        </Typography>
    );
}

function PickerBody(props: BodyProps) {
    switch (props.kind) {
        case "assignees":
            return <AssigneePicker {...props} />;
        case "labels":
            return <LabelPicker {...props} />;
        case "priority":
            return <PriorityPicker {...props} />;
        case "due":
            return <DueDatePicker {...props} />;
        case "move":
            return <MovePicker {...props} />;
    }
}

function closeOnEscape(onClose: () => void) {
    return (_event: unknown, reason: AutocompleteCloseReason) => {
        if (reason === "escape") onClose();
    };
}

function AssigneePicker({
    task,
    members,
    titleId,
    onClose,
    onAssigneesChange,
}: BodyProps) {
    // Local value so quick successive picks build on each other before the
    // board reloads with the saved assignees.
    const [value, setValue] = useState<User[]>(task.assignees ?? []);
    const label = getTaskLabel(task);

    return (
        <>
            <PickerTitle id={titleId}>Assignees · {label}</PickerTitle>
            <Autocomplete
                open
                multiple
                disableCloseOnSelect
                options={members}
                value={value}
                onChange={(_e, next) => {
                    setValue(next);
                    onAssigneesChange(
                        task,
                        next.map((u) => u.id),
                    );
                }}
                onClose={closeOnEscape(onClose)}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, v) => option.id === v.id}
                PopperComponent={InlinePopper}
                renderTags={() => null}
                noOptionsText="No matching members"
                renderInput={(params) => (
                    <TextField
                        {...params}
                        autoFocus
                        size="small"
                        placeholder="Search members"
                        sx={{ px: 1.5 }}
                        slotProps={{
                            htmlInput: {
                                ...params.inputProps,
                                "aria-label": `Assignees for ${label}`,
                            },
                        }}
                    />
                )}
                renderOption={(optionProps, option, { selected }) => {
                    const { key, ...liProps } =
                        optionProps as typeof optionProps & {
                            key: string;
                        };
                    return (
                        <Box
                            component="li"
                            key={key}
                            {...liProps}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Avatar
                                alt=""
                                src={option.avatar_url}
                                sx={{
                                    width: 24,
                                    height: 24,
                                    fontSize: "0.7rem",
                                    bgcolor: harborAvatarColor(option.name),
                                    color: "#fff",
                                }}
                            >
                                {option.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" sx={{ flex: 1 }}>
                                {option.name}
                            </Typography>
                            {selected && <SelectedMark />}
                        </Box>
                    );
                }}
            />
        </>
    );
}

function LabelPicker({
    task,
    labels,
    titleId,
    onClose,
    onLabelsChange,
}: BodyProps) {
    const [value, setValue] = useState<Label[]>(task.labels ?? []);
    const label = getTaskLabel(task);

    return (
        <>
            <PickerTitle id={titleId}>Labels · {label}</PickerTitle>
            <Autocomplete
                open
                multiple
                disableCloseOnSelect
                options={labels}
                value={value}
                onChange={(_e, next) => {
                    setValue(next);
                    onLabelsChange(
                        task,
                        next.map((l) => l.id),
                    );
                }}
                onClose={closeOnEscape(onClose)}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, v) => option.id === v.id}
                PopperComponent={InlinePopper}
                renderTags={() => null}
                noOptionsText={
                    labels.length === 0
                        ? "This team has no labels yet"
                        : "No matching labels"
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        autoFocus
                        size="small"
                        placeholder="Search labels"
                        sx={{ px: 1.5 }}
                        slotProps={{
                            htmlInput: {
                                ...params.inputProps,
                                "aria-label": `Labels for ${label}`,
                            },
                        }}
                    />
                )}
                renderOption={(optionProps, option, { selected }) => {
                    const { key, ...liProps } =
                        optionProps as typeof optionProps & {
                            key: string;
                        };
                    return (
                        <Box
                            component="li"
                            key={key}
                            {...liProps}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Box
                                aria-hidden
                                sx={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: "50%",
                                    bgcolor: option.color,
                                    flexShrink: 0,
                                }}
                            />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                                {option.name}
                            </Typography>
                            {selected && <SelectedMark />}
                        </Box>
                    );
                }}
            />
        </>
    );
}

function SelectedMark() {
    return (
        <Box
            component="span"
            sx={{ color: harbor.accent, fontWeight: 700, fontSize: 13 }}
        >
            ✓
        </Box>
    );
}

function PriorityPicker({
    task,
    titleId,
    onClose,
    onPriorityChange,
}: BodyProps) {
    return (
        <>
            <PickerTitle id={titleId}>
                Priority · {getTaskLabel(task)}
            </PickerTitle>
            <MenuList
                autoFocusItem
                aria-labelledby={titleId}
                sx={{ pt: 0 }}
                onKeyDown={(event) => {
                    // The digit shortcuts work here too.
                    const priority = PRIORITY_KEYS[event.key];
                    if (priority && !event.metaKey && !event.ctrlKey) {
                        event.preventDefault();
                        onPriorityChange(task, priority);
                        onClose();
                    }
                }}
            >
                {PRIORITY_OPTIONS.map((option) => (
                    <MenuItem
                        key={option.value}
                        selected={task.priority === option.value}
                        onClick={() => {
                            onPriorityChange(task, option.value);
                            onClose();
                        }}
                    >
                        <ListItemIcon>
                            <FlagIcon
                                sx={{ fontSize: 16, color: option.color }}
                            />
                        </ListItemIcon>
                        <ListItemText>{option.label}</ListItemText>
                        <Box
                            component="kbd"
                            sx={{
                                fontFamily: "inherit",
                                fontSize: 11,
                                fontWeight: 700,
                                color: harbor.sub,
                                bgcolor: harbor.countBg,
                                borderRadius: "5px",
                                px: 0.75,
                            }}
                        >
                            {PRIORITY_KEY_BY_VALUE[option.value]}
                        </Box>
                    </MenuItem>
                ))}
            </MenuList>
        </>
    );
}

function DueDatePicker({ task, titleId, onClose, onDueDateChange }: BodyProps) {
    const initial = toDateInputValue(task.due_date);
    const [value, setValue] = useState(initial);

    const apply = (next: string | null) => {
        if ((next ?? "") !== initial) onDueDateChange(task, next || null);
        onClose();
    };

    return (
        <Box
            component="form"
            onSubmit={(event) => {
                event.preventDefault();
                apply(value);
            }}
            sx={{ px: 1.5, pb: 1.5 }}
        >
            <PickerTitle id={titleId}>
                Due date · {getTaskLabel(task)}
            </PickerTitle>
            <TextField
                type="date"
                size="small"
                fullWidth
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                slotProps={{
                    htmlInput: {
                        "aria-label": `Due date for ${getTaskLabel(task)}`,
                    },
                }}
            />
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 1,
                    mt: 1,
                }}
            >
                {initial && (
                    <Button
                        size="small"
                        color="error"
                        onClick={() => apply(null)}
                    >
                        Clear
                    </Button>
                )}
                <Button
                    size="small"
                    variant="contained"
                    type="submit"
                    disableElevation
                >
                    Save
                </Button>
            </Box>
        </Box>
    );
}

function MovePicker({
    task,
    columns,
    titleId,
    onClose,
    onMove,
    isColumnFull,
}: BodyProps) {
    const label = getTaskLabel(task);
    const [inputValue, setInputValue] = useState("");

    // Reset the search each time a picker for a different task opens.
    useEffect(() => setInputValue(""), [task.id]);

    return (
        <>
            <PickerTitle id={titleId}>Move · {label}</PickerTitle>
            <Autocomplete
                open
                options={columns}
                value={null}
                inputValue={inputValue}
                onInputChange={(_e, next) => setInputValue(next)}
                onChange={(_e, column) => {
                    if (!column) return;
                    onMove(task, column.id);
                    onClose();
                }}
                onClose={closeOnEscape(onClose)}
                getOptionLabel={(option) => option.name}
                getOptionDisabled={(option) =>
                    option.id === task.column_id || isColumnFull(option)
                }
                PopperComponent={InlinePopper}
                noOptionsText="No matching columns"
                renderInput={(params) => (
                    <TextField
                        {...params}
                        autoFocus
                        size="small"
                        placeholder="Search columns"
                        sx={{ px: 1.5 }}
                        slotProps={{
                            htmlInput: {
                                ...params.inputProps,
                                "aria-label": `Move ${label} to column`,
                            },
                        }}
                    />
                )}
                renderOption={(optionProps, option) => {
                    const { key, ...liProps } =
                        optionProps as typeof optionProps & {
                            key: string;
                        };
                    const current = option.id === task.column_id;
                    const full = !current && isColumnFull(option);
                    return (
                        <Box
                            component="li"
                            key={key}
                            {...liProps}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Box
                                aria-hidden
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    bgcolor:
                                        option.color || harbor.colDots.backlog,
                                    flexShrink: 0,
                                }}
                            />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                                {option.name}
                            </Typography>
                            {(current || full) && (
                                <Typography
                                    variant="caption"
                                    sx={{ color: harbor.sub }}
                                >
                                    {current ? "Current" : "WIP limit reached"}
                                </Typography>
                            )}
                        </Box>
                    );
                }}
            />
        </>
    );
}
