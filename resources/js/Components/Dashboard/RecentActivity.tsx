import { harbor, harborAvatarColor } from "@/theme/harbor";
import type { PageProps } from "@/types";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { Link, usePage } from "@inertiajs/react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { describeActivity } from "./dashboardUtils";
import DashboardSection, { EmptyState } from "./DashboardSection";
import type { DashboardActivity } from "./types";

function ActivityItem({
    activity,
    currentUserId,
}: {
    activity: DashboardActivity;
    currentUserId: string;
}) {
    const actorName = activity.user
        ? activity.user.id === currentUserId
            ? "You"
            : activity.user.name
        : "Someone";
    const avatarName = activity.user?.name ?? "?";
    const { before, after } = describeActivity(
        activity.action,
        activity.changes,
    );
    const taskHref = route("tasks.show", [
        activity.team.slug,
        activity.board.slug,
        activity.task.slug ?? activity.task.id,
    ]);
    const boardHref = route("teams.boards.show", [
        activity.team.slug,
        activity.board.slug,
    ]);

    return (
        <Box
            component="li"
            sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}
        >
            <Avatar
                src={activity.user?.avatar_url}
                alt=""
                aria-hidden="true"
                sx={{
                    width: 26,
                    height: 26,
                    mt: 0.25,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    bgcolor: harborAvatarColor(avatarName),
                    color: "#fff",
                }}
            >
                {avatarName.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 12.5,
                        color: harbor.sub,
                        lineHeight: 1.45,
                        overflowWrap: "anywhere",
                    }}
                >
                    <Box
                        component="span"
                        sx={{ fontWeight: 700, color: harbor.ink }}
                    >
                        {actorName}
                    </Box>{" "}
                    {before}{" "}
                    <MuiLink
                        component={Link}
                        href={taskHref}
                        underline="always"
                        sx={{ fontWeight: 600, color: harbor.ink }}
                    >
                        {activity.task.title}
                    </MuiLink>
                    {after ? ` ${after}` : ""}
                </Typography>
                <Typography
                    sx={{
                        fontSize: 11.5,
                        color: harbor.sub,
                        mt: 0.25,
                        display: "flex",
                        flexWrap: "wrap",
                        columnGap: 0.75,
                        minWidth: 0,
                    }}
                >
                    <MuiLink
                        component={Link}
                        href={boardHref}
                        underline="hover"
                        sx={{ color: "inherit", overflowWrap: "anywhere" }}
                    >
                        {activity.board.name}
                    </MuiLink>
                    <span aria-hidden="true">·</span>
                    <time
                        dateTime={activity.created_at}
                        title={new Date(activity.created_at).toLocaleString()}
                    >
                        {formatTimestamp(activity.created_at)}
                    </time>
                </Typography>
            </Box>
        </Box>
    );
}

export default function RecentActivity({
    activities,
}: {
    activities: DashboardActivity[];
}) {
    const { auth } = usePage<PageProps>().props;

    return (
        <DashboardSection id="recent-activity" title="Recent activity">
            {activities.length === 0 ? (
                <EmptyState title="No activity yet">
                    Changes to tasks on your boards will show up here.
                </EmptyState>
            ) : (
                <Box
                    component="ul"
                    sx={{
                        listStyle: "none",
                        m: 0,
                        p: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.6,
                    }}
                >
                    {activities.map((activity) => (
                        <ActivityItem
                            key={activity.id}
                            activity={activity}
                            currentUserId={auth.user.id}
                        />
                    ))}
                </Box>
            )}
        </DashboardSection>
    );
}
