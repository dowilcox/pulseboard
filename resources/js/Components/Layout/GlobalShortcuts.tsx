import { useShortcuts } from "@/Contexts/KeyboardShortcutsContext";
import { useSidebar } from "@/Contexts/SidebarContext";
import { router } from "@inertiajs/react";

/**
 * App-wide "go to" sequences. Rendered once by the persistent layout (inside
 * SidebarProvider, for the current team); renders nothing.
 */
export default function GlobalShortcuts() {
    const { currentTeam } = useSidebar();

    useShortcuts([
        {
            id: "go-dashboard",
            keys: "g d",
            description: "Go to dashboard",
            group: "Go to",
            handler: () => router.visit(route("dashboard")),
        },
        {
            id: "go-notifications",
            keys: "g n",
            description: "Go to notifications",
            group: "Go to",
            handler: () => router.visit(route("notifications.index")),
        },
        {
            id: "go-boards",
            keys: "g b",
            description: currentTeam
                ? `Go to ${currentTeam.name} boards`
                : "Go to all teams",
            group: "Go to",
            handler: () =>
                router.visit(
                    currentTeam
                        ? route("teams.show", currentTeam.slug)
                        : route("teams.index"),
                ),
        },
    ]);

    return null;
}
