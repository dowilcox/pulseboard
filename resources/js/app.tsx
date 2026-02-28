import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { ThemeContextProvider } from '@/Contexts/ThemeContext';
import { WebSocketProvider } from '@/Contexts/WebSocketContext';
import ErrorBoundary from '@/Components/Common/ErrorBoundary';
import CssBaseline from '@mui/material/CssBaseline';

const appName = import.meta.env.VITE_APP_NAME || 'PulseBoard';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ThemeContextProvider>
                <CssBaseline />
                <ErrorBoundary>
                    <WebSocketProvider>
                        <App {...props} />
                    </WebSocketProvider>
                </ErrorBoundary>
            </ThemeContextProvider>
        );
    },
    progress: {
        color: '#6366f1',
    },
});
