import { router } from '@inertiajs/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import type { Team } from '@/types';

interface TeamSelectorProps {
    teams: Team[];
    currentTeam?: Team;
}

export default function TeamSelector({ teams, currentTeam }: TeamSelectorProps) {
    const handleChange = (event: SelectChangeEvent<string>) => {
        const teamId = event.target.value;
        if (teamId && teamId !== currentTeam?.id) {
            router.get(route('teams.show', teamId));
        }
    };

    if (teams.length === 0) {
        return (
            <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    No teams yet
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ px: 1.5 }}>
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
