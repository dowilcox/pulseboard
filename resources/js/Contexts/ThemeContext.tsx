import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme, darkTheme } from '@/theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    resolvedMode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'system',
    setMode: () => {},
    resolvedMode: 'light',
});

export function useThemeMode() {
    return useContext(ThemeContext);
}

function getSystemPreference(): 'light' | 'dark' {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

export function ThemeContextProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('pulseboard-theme') as ThemeMode) || 'system';
        }
        return 'system';
    });

    const [systemPref, setSystemPref] = useState<'light' | 'dark'>(getSystemPreference);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? 'dark' : 'light');
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        localStorage.setItem('pulseboard-theme', mode);
    }, [mode]);

    const resolvedMode = mode === 'system' ? systemPref : mode;
    const theme = useMemo(() => (resolvedMode === 'dark' ? darkTheme : lightTheme), [resolvedMode]);

    const value = useMemo(() => ({ mode, setMode, resolvedMode }), [mode, resolvedMode]);

    return (
        <ThemeContext.Provider value={value}>
            <ThemeProvider theme={theme}>
                {children}
            </ThemeProvider>
        </ThemeContext.Provider>
    );
}
