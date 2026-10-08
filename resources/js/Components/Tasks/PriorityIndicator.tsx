import { PRIORITY_COLORS } from "@/constants/priorities";
import type { Task } from "@/types";
import { priorityLabel } from "@/utils/taskCardLabel";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardDoubleArrowUpIcon from "@mui/icons-material/KeyboardDoubleArrowUp";
import Box from "@mui/material/Box";
import type { SvgIconComponent } from "@mui/icons-material";

const ICONS: Record<Exclude<Task["priority"], "none">, SvgIconComponent> = {
    urgent: KeyboardDoubleArrowUpIcon,
    high: KeyboardArrowUpIcon,
    medium: DragHandleIcon,
    low: KeyboardArrowDownIcon,
};

interface Props {
    priority: Task["priority"];
    /** Show the word ("High") next to the icon. */
    showLabel?: boolean;
    fontSize?: number;
}

/**
 * Priority shown by shape (chevrons / bars) and, optionally, text — never by
 * colour alone. Renders nothing for "none".
 */
export default function PriorityIndicator({
    priority,
    showLabel = true,
    fontSize = 11.5,
}: Props) {
    if (priority === "none") return null;
    const Icon = ICONS[priority];
    const color = PRIORITY_COLORS[priority];

    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                color,
                fontSize,
                fontWeight: 700,
                lineHeight: 1,
                whiteSpace: "nowrap",
                flexShrink: 0,
            }}
        >
            <Icon sx={{ fontSize: fontSize + 4.5 }} aria-hidden />
            {showLabel ? (
                priorityLabel(priority)
            ) : (
                <Box component="span" sx={visuallyHidden}>
                    {priorityLabel(priority)} priority
                </Box>
            )}
        </Box>
    );
}

const visuallyHidden = {
    position: "absolute",
    width: "1px",
    height: "1px",
    p: 0,
    m: -1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
} as const;
