import { router } from '@inertiajs/react';
import AddIcon from '@mui/icons-material/Add';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { Board } from '@/types';

interface BoardListProps {
    boards: Board[];
    teamId: string;
    activeBoardId?: string;
}

export default function BoardList({ boards, teamId, activeBoardId }: BoardListProps) {
    const handleBoardClick = (boardId: string) => {
        router.get(route('teams.boards.show', [teamId, boardId]));
    };

    const handleAddBoard = () => {
        router.get(route('teams.boards.create', teamId));
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Box sx={{ px: 2, py: 1 }}>
                <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em' }}
                >
                    Boards
                </Typography>
            </Box>

            {boards.length === 0 ? (
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        No boards yet
                    </Typography>
                </Box>
            ) : (
                <List dense disablePadding>
                    {boards.map((board) => (
                        <ListItem key={board.id} disablePadding>
                            <ListItemButton
                                selected={board.id === activeBoardId}
                                onClick={() => handleBoardClick(board.id)}
                                sx={{
                                    px: 2.5,
                                    py: 0.75,
                                    '&.Mui-selected': {
                                        bgcolor: 'action.selected',
                                        '&:hover': {
                                            bgcolor: 'action.selected',
                                        },
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    <DashboardIcon
                                        fontSize="small"
                                        color={board.id === activeBoardId ? 'primary' : 'action'}
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primary={board.name}
                                    primaryTypographyProps={{
                                        variant: 'body2',
                                        noWrap: true,
                                        fontWeight: board.id === activeBoardId ? 600 : 400,
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}

            <Box sx={{ px: 1.5, pt: 1 }}>
                <Button
                    startIcon={<AddIcon />}
                    size="small"
                    onClick={handleAddBoard}
                    sx={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        color: 'text.secondary',
                        '&:hover': {
                            color: 'primary.main',
                        },
                    }}
                >
                    Add Board
                </Button>
            </Box>
        </Box>
    );
}
