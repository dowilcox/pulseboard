import { router, usePage } from '@inertiajs/react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { PageProps } from '@/types';
import { useSidebar } from '@/Contexts/SidebarContext';

interface TeamSelectorProps {
    collapsed?: boolean;
}

export default function TeamSelector({ collapsed }: TeamSelectorProps) {
    const { teams: sharedTeams } = usePage<PageProps>().props;
    const teams = sharedTeams ?? [];
    const { currentTeam, setSelectedTeamId } = useSidebar();

    const handleChange = (event: SelectChangeEvent<string>) => {
        const teamId = event.target.value;
        if (teamId && teamId !== currentTeam?.id) {
            setSelectedTeamId(teamId);
            router.get(route('teams.show', teamId));
        }
    };

    const handleCollapsedClick = () => {
        if (currentTeam) {
            router.get(route('teams.show', currentTeam.id));
        }
    };

    if (teams.length === 0) {
        return (
            <Box sx={{ px: 2, py: 1 }}>
                {!collapsed && (
                    <Typography variant="body2" color="text.secondary">
                        No teams yet
                    </Typography>
                )}
            </Box>
        );
    }

    if (collapsed) {
        const initial = currentTeam?.name?.charAt(0).toUpperCase() ?? '?';
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                <Tooltip title={currentTeam?.name ?? 'Select a team'} placement="right">
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            cursor: 'pointer',
                        }}
                        onClick={handleCollapsedClick}
                    >
                        {initial}
                    </Avatar>
                </Tooltip>
            </Box>
        );
    }

    return (
        <Box sx={{ px: 2 }}>
            <Select
                value={currentTeam?.id ?? ''}
                onChange={handleChange}
                displayEmpty
                fullWidth
                size="small"
                sx={{
                    '& .MuiSelect-select': {
                        py: 1,
                        display: 'flex',
                        alignItems: 'center',
                    },
                }}
                renderValue={(selected) => {
                    if (!selected) {
                        return (
                            <Typography variant="body2" color="text.secondary">
                                Select a team
                            </Typography>
                        );
                    }
                    const team = teams.find((t) => t.id === selected);
                    return (
                        <Typography variant="body2" fontWeight={600} noWrap>
                            {team?.name ?? 'Unknown team'}
                        </Typography>
                    );
                }}
            >
                {teams.map((team) => {
                    const member = team.members?.[0];
                    const role = member?.role;

                    return (
                        <MenuItem key={team.id} value={team.id}>
                            <ListItemText
                                primary={team.name}
                                primaryTypographyProps={{ variant: 'body2' }}
                            />
                            {role && (
                                <Chip
                                    label={role}
                                    size="small"
                                    variant="outlined"
                                    color={
                                        role === 'owner'
                                            ? 'primary'
                                            : role === 'admin'
                                              ? 'secondary'
                                              : 'default'
                                    }
                                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                />
                            )}
                        </MenuItem>
                    );
                })}
            </Select>
        </Box>
    );
}
