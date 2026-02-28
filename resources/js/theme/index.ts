import { createTheme, type ThemeOptions } from '@mui/material/styles';

const commonOptions: ThemeOptions = {
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                },
            },
        },
    },
};

export const lightTheme = createTheme({
    ...commonOptions,
    palette: {
        mode: 'light',
        primary: {
            main: '#6366f1', // indigo
        },
        secondary: {
            main: '#ec4899', // pink
        },
        background: {
            default: '#f5f5f5',
            paper: '#ffffff',
        },
    },
});

export const darkTheme = createTheme({
    ...commonOptions,
    palette: {
        mode: 'dark',
        primary: {
            main: '#818cf8', // lighter indigo for dark mode
        },
        secondary: {
            main: '#f472b6', // lighter pink for dark mode
        },
        background: {
            default: '#121212',
            paper: '#1e1e1e',
        },
    },
});
