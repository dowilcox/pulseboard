import Chip from '@mui/material/Chip';
import MergeIcon from '@mui/icons-material/MergeType';
import type { TaskGitlabLink } from '@/types';

interface Props {
    link: TaskGitlabLink;
}

const stateColors: Record<string, 'success' | 'error' | 'info' | 'default'> = {
    opened: 'info',
    merged: 'success',
    closed: 'error',
};

export default function MergeRequestChip({ link }: Props) {
    const color = stateColors[link.state ?? ''] ?? 'default';

    return (
        <Chip
            icon={<MergeIcon />}
            label={`!${link.gitlab_iid}`}
            color={color}
            size="small"
            variant="outlined"
            component="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            sx={{ height: 24, fontSize: '0.75rem' }}
        />
    );
}
