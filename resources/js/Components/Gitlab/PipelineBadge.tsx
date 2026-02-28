import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface Props {
    status?: string | null;
    size?: 'small' | 'medium';
}

const statusConfig: Record<string, { color: 'success' | 'error' | 'warning' | 'default'; icon: React.ReactElement; label: string }> = {
    success: { color: 'success', icon: <CheckCircleIcon />, label: 'Passed' },
    passed: { color: 'success', icon: <CheckCircleIcon />, label: 'Passed' },
    failed: { color: 'error', icon: <ErrorIcon />, label: 'Failed' },
    running: { color: 'warning', icon: <PlayArrowIcon />, label: 'Running' },
    pending: { color: 'default', icon: <HourglassEmptyIcon />, label: 'Pending' },
    created: { color: 'default', icon: <HourglassEmptyIcon />, label: 'Created' },
    canceled: { color: 'default', icon: <ErrorIcon />, label: 'Canceled' },
};

export default function PipelineBadge({ status, size = 'small' }: Props) {
    if (!status) return null;

    const config = statusConfig[status] ?? {
        color: 'default' as const,
        icon: <HourglassEmptyIcon />,
        label: status,
    };

    return (
        <Chip
            icon={config.icon}
            label={config.label}
            color={config.color}
            size={size}
            variant="outlined"
            sx={{ textTransform: 'capitalize' }}
        />
    );
}
