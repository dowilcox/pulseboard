import type { BoardViewMode } from '@/types';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TableRowsIcon from '@mui/icons-material/TableRows';
import TimelineIcon from '@mui/icons-material/Timeline';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import WorkIcon from '@mui/icons-material/Work';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';

interface Props {
    value: BoardViewMode;
    onChange: (mode: BoardViewMode) => void;
}

const views: { value: BoardViewMode; label: string; icon: React.ReactElement }[] = [
    { value: 'kanban', label: 'Kanban', icon: <ViewColumnIcon fontSize="small" /> },
    { value: 'list', label: 'List', icon: <TableRowsIcon fontSize="small" /> },
    { value: 'calendar', label: 'Calendar', icon: <CalendarMonthIcon fontSize="small" /> },
    { value: 'timeline', label: 'Timeline', icon: <TimelineIcon fontSize="small" /> },
    { value: 'workload', label: 'Workload', icon: <WorkIcon fontSize="small" /> },
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
        >
            {views.map((view) => (
                <Tooltip key={view.value} title={view.label}>
                    <ToggleButton value={view.value} sx={{ px: 1.5 }}>
                        {view.icon}
                    </ToggleButton>
                </Tooltip>
            ))}
        </ToggleButtonGroup>
    );
}
