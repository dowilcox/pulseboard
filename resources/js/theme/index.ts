import { createTheme, type ThemeOptions } from '@mui/material/styles';

const commonOptions: ThemeOptions = {
    typography: {
        fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
        h4: {
            letterSpacing: '-0.03em',
        },
        h5: {
            letterSpacing: '-0.02em',
        },
        h6: {
            letterSpacing: '-0.01em',
        },
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
        MuiPaper: {
            styleOverrides: {
                rounded: {
                    borderRadius: 10,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                sizeSmall: {
                    height: 22,
                },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                sizeSmall: {
                    padding: '4px 10px',
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-head': {
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        letterSpacing: '0.02em',
                    },
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
            main: '#6366f1',
        },
        secondary: {
            main: '#ec4899',
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
            main: '#818cf8',
        },
        secondary: {
            main: '#f472b6',
        },
        background: {
            default: '#191919',
            paper: '#262626',
        },
        text: {
            primary: 'rgba(255,255,255,0.87)',
            secondary: 'rgba(255,255,255,0.55)',
        },
        divider: 'rgba(255,255,255,0.10)',
    },
    components: {
        ...commonOptions.components,
        MuiPaper: {
            ...commonOptions.components?.MuiPaper,
            styleOverrides: {
                ...commonOptions.components?.MuiPaper?.styleOverrides,
                root: {
                    backgroundImage: 'none',
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: '#1f1f1f',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.16)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.30)',
                    },
                },
            },
        },
    },
});
