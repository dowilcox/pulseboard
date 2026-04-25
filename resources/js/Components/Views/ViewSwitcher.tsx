import type { BoardViewMode } from "@/types";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import WorkIcon from "@mui/icons-material/Work";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import type { ReactElement } from "react";

interface Props {
    value: BoardViewMode;
    onChange: (mode: BoardViewMode) => void;
}

const views: {
    value: BoardViewMode;
    label: string;
    icon: ReactElement;
}[] = [
    {
        value: "kanban",
        label: "Board view",
        icon: <ViewColumnIcon fontSize="small" />,
    },
    { value: "list", label: "List", icon: <TableRowsIcon fontSize="small" /> },
    {
        value: "workload",
        label: "Workload",
        icon: <WorkIcon fontSize="small" />,
    },
];

export default function ViewSwitcher({ value, onChange }: Props) {
    return (
        <ToggleButtonGroup
            value={value}
            exclusive
            onChange={(_e, newValue) => {
                if (newValue) onChange(newValue as BoardViewMode);
            }}
            size="small"
            sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1.5,
                bgcolor: "background.paper",
                overflow: "hidden",
            }}
        >
            {views.map((view) => (
                <Tooltip key={view.value} title={view.label}>
                    <ToggleButton
                        value={view.value}
                        aria-label={view.label}
                        sx={{
                            gap: 1,
                            px: 1.25,
                            minWidth: 48,
                            border: 0,
                            color: "text.secondary",
                            "&.Mui-selected": {
                                bgcolor: "action.selected",
                                color: "text.primary",
                            },
                        }}
                    >
                        {view.icon}
                    </ToggleButton>
                </Tooltip>
            ))}
        </ToggleButtonGroup>
    );
}
