import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, useForm, router, usePage } from "@inertiajs/react";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import type {
    Board,
    BoardTemplate,
    PageProps,
    Team,
    UserWithTeamPivot,
} from "@/types";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DownloadIcon from "@mui/icons-material/Download";
import BrushIcon from "@mui/icons-material/Brush";
import GitlabIcon from "@mui/icons-material/AccountTree";
import SettingsIcon from "@mui/icons-material/Settings";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid2";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface ColumnStat {
    column_name: string;
    is_done_column: boolean;
    count: number;
}

interface OverdueTask {
    id: string;
    title: string;
    task_number?: number;
    due_date: string;
    board?: { id: string; name: string };
    column?: { name: string };
    assignees?: { id: string; name: string }[];
}

interface Stats {
    tasks_by_column: ColumnStat[];
    overdue_tasks: OverdueTask[];
    cycle_time: number;
}

interface Props {
    team: Team;
    members: UserWithTeamPivot[];
    boards: Board[];
}

export default function TeamsShow({ team, members, boards }: Props) {
    const { teams: sharedTeams } = usePage<PageProps>().props;
    const userRole = sharedTeams?.find((t) => t.id === team.id)?.pivot?.role;
    const canManage = userRole === "owner" || userRole === "admin";

    const [createOpen, setCreateOpen] = useState(false);
    const [createTab, setCreateTab] = useState(0);
    const [templates, setTemplates] = useState<BoardTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] =
        useState<BoardTemplate | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: "",
        description: "",
    });

    const fetchTemplates = useCallback(() => {
        setTemplatesLoading(true);
        axios
            .get(route("templates.index"))
            .then(({ data }) => {
                setTemplates(data as BoardTemplate[]);
                setTemplatesLoading(false);
            })
            .catch(() => setTemplatesLoading(false));
    }, []);

    useEffect(() => {
        axios
            .get(route("teams.dashboard.stats", team.slug))
            .then(({ data }) => {
                setStats(data as Stats);
                setStatsLoading(false);
            })
            .catch(() => setStatsLoading(false));
    }, [team.id]);

    const columnData = (stats?.tasks_by_column ?? []).map((c) => ({
        name: c.column_name,
        count: c.count,
        isDone: c.is_done_column,
    }));

    const totalTasks = columnData.reduce((s, c) => s + c.count, 0);
    const completedTasks = columnData
        .filter((c) => c.isDone)
        .reduce((s, c) => s + c.count, 0);
    const overdueTasks = stats?.overdue_tasks ?? [];

    const handleCreateBoard = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedTemplate) {
            router.post(
                route("teams.templates.create-board", [
                    team.slug,
                    selectedTemplate.id,
                ]),
                { name: data.name, description: data.description },
                {
                    onSuccess: () => {
                        setCreateOpen(false);
                        reset();
                        setSelectedTemplate(null);
                        setCreateTab(0);
                    },
                },
            );
        } else {
            post(route("teams.boards.store", team.slug), {
                onSuccess: () => {
                    setCreateOpen(false);
                    reset();
                },
            });
        }
    };

    const handleClose = () => {
        setCreateOpen(false);
        reset();
        setSelectedTemplate(null);
        setCreateTab(0);
    };

    const handleOpenCreate = () => {
        setCreateOpen(true);
        fetchTemplates();
    };

    const handleSelectTemplate = (template: BoardTemplate) => {
        setSelectedTemplate(template);
        setData({
            name: template.name,
            description: template.description ?? "",
        });
    };

    return (
        <AuthenticatedLayout
            currentTeam={team}
            sidebarBoards={boards}
            header={
                <PageHeader
                    title={team.name}
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                    ]}
                    actions={
                        <>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                size="small"
                                href={route("teams.export.csv", team.slug)}
                            >
                                Export CSV
                            </Button>
                            {canManage && (
                                <Button
                                    variant="outlined"
                                    startIcon={<GitlabIcon />}
                                    size="small"
                                    onClick={() =>
                                        router.get(
                                            route(
                                                "teams.gitlab-projects.index",
                                                team.slug,
                                            ),
                                        )
                                    }
                                >
                                    GitLab
                                </Button>
                            )}
                            {canManage && (
                                <Button
                                    variant="outlined"
                                    startIcon={<BrushIcon />}
                                    size="small"
                                    onClick={() =>
                                        router.get(
                                            route(
                                                "teams.figma.index",
                                                team.slug,
                                            ),
                                        )
                                    }
                                >
                                    Figma
                                </Button>
                            )}
                            {canManage && (
                                <Button
                                    variant="outlined"
                                    startIcon={<SettingsIcon />}
                                    size="small"
                                    onClick={() =>
                                        router.get(
                                            route("teams.settings", team.slug),
                                        )
                                    }
                                >
                                    Settings
                                </Button>
                            )}
                            {canManage && (
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    size="small"
                                    onClick={handleOpenCreate}
                                >
                                    Create Board
                                </Button>
                            )}
                        </>
                    }
                />
            }
        >
            <Head title={team.name} />

            {/* Team info */}
            <Paper
                elevation={0}
                sx={{ p: 2.5, mb: 3, bgcolor: "action.hover" }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        mb: team.description ? 1.5 : 0,
                    }}
                >
                    <Avatar
                        src={team.image_url ?? undefined}
                        sx={{
                            width: 40,
                            height: 40,
                            fontSize: "1rem",
                            fontWeight: 600,
                            mr: 1.5,
                            bgcolor: "primary.main",
                        }}
                    >
                        {team.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="h6" fontWeight={600}>
                        {team.name}
                    </Typography>
                </Box>
                {team.description && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1.5 }}
                    >
                        {team.description}
                    </Typography>
                )}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <AvatarGroup
                        max={5}
                        sx={{
                            "& .MuiAvatar-root": {
                                width: 28,
                                height: 28,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                            },
                        }}
                    >
                        {members.map((member) => (
                            <Tooltip key={member.id} title={member.name}>
                                <Avatar
                                    src={member.avatar_url}
                                    alt={member.name}
                                >
                                    {member.name.charAt(0).toUpperCase()}
                                </Avatar>
                            </Tooltip>
                        ))}
                    </AvatarGroup>
                    <Typography variant="body2" color="text.secondary">
                        {members.length} member{members.length !== 1 ? "s" : ""}
                    </Typography>
                </Box>
            </Paper>

            {/* Summary stats */}
            {statsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress size={28} />
                </Box>
            ) : stats ? (
                <Grid container spacing={2} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                fontWeight={600}
                            >
                                Total Tasks
                            </Typography>
                            <Typography
                                variant="h4"
                                component="p"
                                fontWeight={700}
                                sx={{ mt: 0.5 }}
                            >
                                {totalTasks}
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                fontWeight={600}
                            >
                                Completed
                            </Typography>
                            <Typography
                                variant="h4"
                                component="p"
                                fontWeight={700}
                                color="success.main"
                                sx={{ mt: 0.5 }}
                            >
                                {completedTasks}
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                fontWeight={600}
                            >
                                Overdue
                            </Typography>
                            <Typography
                                variant="h4"
                                component="p"
                                fontWeight={700}
                                color={
                                    overdueTasks.length > 0
                                        ? "error.main"
                                        : "text.primary"
                                }
                                sx={{ mt: 0.5 }}
                            >
                                {overdueTasks.length}
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                fontWeight={600}
                            >
                                Avg Cycle Time
                            </Typography>
                            <Typography
                                variant="h4"
                                component="p"
                                fontWeight={700}
                                sx={{ mt: 0.5 }}
                            >
                                {stats.cycle_time > 0 ? (
                                    <>
                                        {stats.cycle_time}
                                        <Typography
                                            component="span"
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {" "}
                                            days
                                        </Typography>
                                    </>
                                ) : (
                                    <Box
                                        component="span"
                                        sx={{ color: "text.secondary" }}
                                    >
                                        —
                                    </Box>
                                )}
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            ) : null}

            {/* Boards */}
            {boards.length > 0 && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={600}
                    sx={{ display: "block", mb: 1.5, letterSpacing: "0.02em" }}
                >
                    Boards
                </Typography>
            )}

            {boards.length === 0 ? (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        py: 8,
                    }}
                >
                    <DashboardIcon
                        sx={{ fontSize: 48, color: "text.disabled", mb: 2 }}
                    />
                    <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        gutterBottom
                    >
                        No boards yet
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5, mb: 3 }}
                    >
                        Create your first board to start organizing tasks.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenCreate}
                    >
                        Create Board
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {boards.map((board) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={board.id}>
                            <Card
                                variant="outlined"
                                sx={{
                                    transition:
                                        "border-color 150ms ease, background-color 150ms ease",
                                    "&:hover": {
                                        borderColor: "action.selected",
                                    },
                                }}
                            >
                                <CardActionArea
                                    onClick={() =>
                                        router.get(
                                            route("teams.boards.show", [
                                                team.slug,
                                                board.slug,
                                            ]),
                                        )
                                    }
                                >
                                    <CardContent
                                        sx={{
                                            p: 2.5,
                                            "&:last-child": { pb: 2.5 },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                mb: 1,
                                            }}
                                        >
                                            <Avatar
                                                src={
                                                    board.image_url ?? undefined
                                                }
                                                variant="rounded"
                                                sx={{
                                                    width: 24,
                                                    height: 24,
                                                    fontSize: "0.7rem",
                                                    fontWeight: 600,
                                                    mr: 1,
                                                    bgcolor: "primary.main",
                                                }}
                                            >
                                                {board.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </Avatar>
                                            <Typography
                                                variant="subtitle1"
                                                component="h3"
                                                fontWeight={600}
                                                noWrap
                                                sx={{ flex: 1 }}
                                            >
                                                {board.name}
                                            </Typography>
                                        </Box>

                                        {board.description && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{
                                                    mb: 1.5,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                }}
                                            >
                                                {board.description}
                                            </Typography>
                                        )}

                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.75,
                                            }}
                                        >
                                            <ViewColumnIcon
                                                sx={{
                                                    fontSize: 16,
                                                    color: "text.disabled",
                                                }}
                                            />
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {board.columns?.length ?? 0}{" "}
                                                column
                                                {(board.columns?.length ??
                                                    0) !== 1
                                                    ? "s"
                                                    : ""}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Create Board Dialog */}
            <Dialog
                open={createOpen}
                onClose={handleClose}
                maxWidth="sm"
                fullWidth
                aria-labelledby="create-board-dialog-title"
            >
                <form onSubmit={handleCreateBoard}>
                    <DialogTitle id="create-board-dialog-title" sx={{ pb: 0 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            Create Board
                        </Typography>
                        <Tabs
                            value={createTab}
                            onChange={(_, v) => {
                                setCreateTab(v);
                                if (v === 0) {
                                    setSelectedTemplate(null);
                                    reset();
                                }
                            }}
                            sx={{ mt: 1 }}
                        >
                            <Tab label="Blank Board" />
                            <Tab label="From Template" />
                        </Tabs>
                    </DialogTitle>
                    <DialogContent sx={{ pt: "16px !important" }}>
                        {createTab === 1 && (
                            <Box sx={{ mb: 2 }}>
                                {templatesLoading ? (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            justifyContent: "center",
                                            py: 3,
                                        }}
                                    >
                                        <CircularProgress size={24} />
                                    </Box>
                                ) : templates.length === 0 ? (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ py: 2, textAlign: "center" }}
                                    >
                                        No templates available. Save a board as
                                        a template from its settings page.
                                    </Typography>
                                ) : (
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            maxHeight: 200,
                                            overflow: "auto",
                                        }}
                                    >
                                        <List disablePadding>
                                            {templates.map((template) => (
                                                <ListItemButton
                                                    key={template.id}
                                                    selected={
                                                        selectedTemplate?.id ===
                                                        template.id
                                                    }
                                                    onClick={() =>
                                                        handleSelectTemplate(
                                                            template,
                                                        )
                                                    }
                                                >
                                                    <ListItemText
                                                        primary={template.name}
                                                        secondary={
                                                            template.description
                                                        }
                                                        primaryTypographyProps={{
                                                            variant: "body2",
                                                            fontWeight: 500,
                                                        }}
                                                        secondaryTypographyProps={{
                                                            variant: "caption",
                                                            noWrap: true,
                                                        }}
                                                    />
                                                    {selectedTemplate?.id ===
                                                        template.id && (
                                                        <CheckCircleOutlineIcon
                                                            color="primary"
                                                            fontSize="small"
                                                        />
                                                    )}
                                                </ListItemButton>
                                            ))}
                                        </List>
                                    </Paper>
                                )}
                            </Box>
                        )}
                        <TextField
                            autoFocus={createTab === 0}
                            label="Board Name"
                            fullWidth
                            required
                            value={data.name}
                            onChange={(e) => setData("name", e.target.value)}
                            error={!!errors.name}
                            helperText={errors.name}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Description"
                            fullWidth
                            multiline
                            rows={3}
                            value={data.description}
                            onChange={(e) =>
                                setData("description", e.target.value)
                            }
                            error={!!errors.description}
                            helperText={errors.description}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button variant="text" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={
                                processing ||
                                (createTab === 1 && !selectedTemplate)
                            }
                        >
                            {selectedTemplate
                                ? "Create from Template"
                                : "Create"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </AuthenticatedLayout>
    );
}
