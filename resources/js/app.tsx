import "../css/app.css";
import "./bootstrap";

import { createInertiaApp, type ResolvedComponent } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { createRoot } from "react-dom/client";
import { AppThemeProvider } from "@/theme/AppThemeProvider";

import ErrorBoundary from "@/Components/Common/ErrorBoundary";
import CssBaseline from "@mui/material/CssBaseline";

const appName = import.meta.env.VITE_APP_NAME || "PulseBoard";

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: async (name) => {
        const page = await resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob<{ default: ResolvedComponent }>(
                "./Pages/**/*.tsx",
            ),
        );
        return page.default;
    },
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <AppThemeProvider>
                <CssBaseline />
                <ErrorBoundary>
                    <App {...props} />
                </ErrorBoundary>
            </AppThemeProvider>,
        );
    },
    progress: {
        color: "#6366f1",
    },
});
