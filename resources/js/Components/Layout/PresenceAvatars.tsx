import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Tooltip from '@mui/material/Tooltip';
import type { PresenceUser } from '@/hooks/usePresence';

interface Props {
    users: PresenceUser[];
    currentUserId: string;
}

export default function PresenceAvatars({ users, currentUserId }: Props) {
    const otherUsers = users.filter((u) => u.id !== currentUserId);

    if (otherUsers.length === 0) return null;

    return (
        <AvatarGroup max={5} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
            {otherUsers.map((user) => (
                <Tooltip key={user.id} title={user.name}>
                    <Avatar
                        src={user.avatar_url ?? undefined}
                        alt={user.name}
                    >
                        {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                </Tooltip>
            ))}
        </AvatarGroup>
    );
}
