import { createTheme, type ThemeOptions } from '@mui/material/styles';

const commonOptions: ThemeOptions = {
    typography: {
        fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
    },
    shape: {
        borderRadius: 10,
    },
    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    textTransform: 'none',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 12,
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
            default: '#fafafa',
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
            default: '#0f0f0f',
            paper: '#181818',
        },
    },
});
