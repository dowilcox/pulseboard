import type { BoardViewMode } from "@/types";
import { harbor } from "@/theme/harbor";
import StackedBarChartIcon from "@mui/icons-material/StackedBarChart";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import Box from "@mui/material/Box";
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
        label: "Board",
        icon: <ViewKanbanOutlinedIcon fontSize="small" />,
    },
    {
        value: "list",
        label: "List",
        icon: <TableRowsIcon fontSize="small" />,
    },
    {
        value: "workload",
        label: "Workload",
        icon: <StackedBarChartIcon fontSize="small" />,
    },
];

/**
 * Board / List / Workload switcher. Text labels show from lg up (with icons
 * again from xl, where the header has room); below lg the icons carry a
 * tooltip. Every button has the same accessible name ("Board view", …).
 *
 * The header shares its row with the board title and the quick switcher, so
 * at 1280px icon + label for all three would truncate the board name.
 */
export default function ViewSwitcher({ value, onChange }: Props) {
    return (
        <ToggleButtonGroup
            value={value}
            exclusive
            onChange={(_e, newValue) => {
                if (newValue) onChange(newValue as BoardViewMode);
            }}
            size="small"
            aria-label="Board layout"
            sx={{
                bgcolor: harbor.card,
                borderRadius: "10px",
                boxShadow: harbor.chipShadow,
                p: "3px",
                gap: "2px",
                "& .MuiToggleButtonGroup-grouped": {
                    border: 0,
                    borderRadius: "8px !important",
                },
            }}
        >
            {views.map((view) => (
                <Tooltip
                    key={view.value}
                    title={`${view.label} view`}
                    // The tooltip only helps while the switcher is icon-only
                    slotProps={{
                        popper: {
                            sx: { display: { lg: "none" } },
                        },
                    }}
                >
                    <ToggleButton
                        value={view.value}
                        aria-label={`${view.label} view`}
                        sx={{
                            gap: 0.75,
                            px: 1.25,
                            py: 0.5,
                            minWidth: 40,
                            color: harbor.sub,
                            fontSize: "13px",
                            fontWeight: 700,
                            textTransform: "none",
                            lineHeight: 1.4,
                            "&:hover": { bgcolor: harbor.countBg },
                            // Tint + accent ring: the selected state must not
                            // rely on a near-identical background alone.
                            "&.Mui-selected, &.Mui-selected:hover": {
                                bgcolor: harbor.tints.indigo.bg,
                                color: harbor.tints.indigo.fg,
                                boxShadow: `inset 0 0 0 1.5px ${harbor.accent}`,
                            },
                        }}
                    >
                        <Box
                            component="span"
                            sx={{
                                display: {
                                    xs: "inline-flex",
                                    lg: "none",
                                    xl: "inline-flex",
                                },
                            }}
                        >
                            {view.icon}
                        </Box>
                        <Box
                            component="span"
                            aria-hidden
                            sx={{ display: { xs: "none", lg: "inline" } }}
                        >
                            {view.label}
                        </Box>
                    </ToggleButton>
                </Tooltip>
            ))}
        </ToggleButtonGroup>
    );
}
