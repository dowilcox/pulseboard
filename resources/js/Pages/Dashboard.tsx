import Deadlines from "@/Components/Dashboard/Deadlines";
import { groupDeadlines } from "@/Components/Dashboard/dashboardUtils";
import MyTasks from "@/Components/Dashboard/MyTasks";
import RecentActivity from "@/Components/Dashboard/RecentActivity";
import StatRow from "@/Components/Dashboard/StatRow";
import type {
    DashboardActivity,
    DashboardBoard,
    DashboardStats,
    DashboardTask,
} from "@/Components/Dashboard/types";
import WelcomePanel from "@/Components/Dashboard/WelcomePanel";
import YourBoards from "@/Components/Dashboard/YourBoards";
import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { PageProps } from "@/types";
import { daysUntil } from "@/utils/formatTimestamp";
import { Head, usePage } from "@inertiajs/react";
import Box from "@mui/material/Box";
import { type ReactElement, useMemo } from "react";

interface Props {
    stats: DashboardStats;
    boards: DashboardBoard[];
    myTasks: DashboardTask[];
    recentActivity: DashboardActivity[];
}

export default function Dashboard({
    stats,
    boards,
    myTasks,
    recentActivity,
}: Props) {
    const { auth, teams = [] } = usePage<PageProps>().props;

    const deadlines = useMemo(() => groupDeadlines(myTasks, 14), [myTasks]);

    // The server counts overdue/due-soon in UTC. When every open task is in
    // the payload (the common case), recount in the viewer's local calendar
    // so the stat cards agree with the deadline lists below them.
    const listComplete = myTasks.length >= stats.open;
    const overdueCount = listComplete
        ? deadlines.overdue.length
        : stats.overdue;
    const dueNext7Count = useMemo(
        () =>
            listComplete
                ? myTasks.filter((task) => {
                      if (!task.due_date) return false;
                      const days = daysUntil(task.due_date);
                      return days >= 0 && days <= 7;
                  }).length
                : stats.due_next_7_days,
        [listComplete, myTasks, stats.due_next_7_days],
    );

    return (
        <>
            <Head title="Dashboard" />
            <LayoutHeader>
                <PageHeader title="Dashboard" />
            </LayoutHeader>

            {teams.length === 0 ? (
                <WelcomePanel userName={auth.user.name} />
            ) : (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        minWidth: 0,
                    }}
                >
                    <StatRow
                        open={stats.open}
                        overdue={overdueCount}
                        dueNext7Days={dueNext7Count}
                        completedLast7Days={stats.completed_last_7_days}
                        completedPrevious7Days={stats.completed_previous_7_days}
                    />

                    <YourBoards boards={boards} teams={teams} />

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "minmax(0, 1fr)",
                                lg: "minmax(0, 1.85fr) minmax(0, 1fr)",
                            },
                            gap: 2,
                            alignItems: "start",
                        }}
                    >
                        <MyTasks tasks={myTasks} totalOpen={stats.open} />
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                minWidth: 0,
                            }}
                        >
                            <Deadlines
                                overdue={deadlines.overdue}
                                dueSoon={deadlines.dueSoon}
                            />
                            <RecentActivity activities={recentActivity} />
                        </Box>
                    </Box>
                </Box>
            )}
        </>
    );
}

Dashboard.layout = (page: ReactElement) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
);
