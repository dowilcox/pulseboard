import { createTheme, type ThemeOptions } from "@mui/material/styles";

const commonOptions: ThemeOptions = {
    typography: {
        fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
        h4: {
            letterSpacing: "-0.03em",
        },
        h5: {
            letterSpacing: "-0.02em",
        },
        h6: {
            letterSpacing: "-0.01em",
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    background:
                        "radial-gradient(circle at 28% -10%, rgba(78, 91, 232, 0.18), transparent 34%), #080f1d",
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    textTransform: "none",
                    borderRadius: 10,
                    fontWeight: 700,
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
                root: {
                    backgroundImage: "none",
                },
                rounded: {
                    borderRadius: 14,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 700,
                    borderRadius: 7,
                },
                sizeSmall: {
                    height: 22,
                },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                sizeSmall: {
                    padding: "4px 10px",
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    "& .MuiTableCell-head": {
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        letterSpacing: "0.02em",
                    },
                },
            },
        },
    },
};

export const lightTheme = createTheme({
    ...commonOptions,
    palette: {
        mode: "light",
        primary: {
            main: "#5f61e8",
            contrastText: "#ffffff",
        },
        secondary: {
            main: "#ec4899",
        },
        background: {
            default: "#fafafa",
            paper: "#ffffff",
        },
    },
});

export const darkTheme = createTheme({
    ...commonOptions,
    palette: {
        mode: "dark",
        primary: {
            main: "#6c5cff",
            light: "#9c8cff",
            dark: "#5142df",
            contrastText: "#ffffff",
        },
        secondary: {
            main: "#13c8e8",
        },
        success: {
            main: "#43d18b",
        },
        warning: {
            main: "#ffb020",
        },
        error: {
            main: "#ff554a",
        },
        background: {
            default: "#080f1d",
            paper: "#101827",
        },
        text: {
            primary: "#f8fafc",
            secondary: "#a8b3c7",
        },
        divider: "rgba(148, 163, 184, 0.18)",
        action: {
            hover: "rgba(148, 163, 184, 0.08)",
            selected: "rgba(108, 92, 255, 0.16)",
            focus: "rgba(108, 92, 255, 0.22)",
            disabled: "rgba(148, 163, 184, 0.32)",
            disabledBackground: "rgba(148, 163, 184, 0.10)",
        },
    },
    components: {
        ...commonOptions.components,
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                    backgroundColor: "#080f1d",
                    borderColor: "rgba(148, 163, 184, 0.16)",
                },
            },
        },
        MuiPaper: {
            ...commonOptions.components?.MuiPaper,
            styleOverrides: {
                ...commonOptions.components?.MuiPaper?.styleOverrides,
                root: {
                    backgroundImage: "none",
                    backgroundColor: "#101827",
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: "#0b1423",
                    borderRadius: 10,
                    "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(148, 163, 184, 0.22)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(148, 163, 184, 0.40)",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#6c5cff",
                        boxShadow: "0 0 0 3px rgba(108, 92, 255, 0.18)",
                    },
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: "#08111f",
                    backgroundImage: "none",
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderColor: "rgba(148, 163, 184, 0.16)",
                },
            },
        },
        MuiLink: {
            styleOverrides: {
                root: {
                    color: "#9c8cff",
                },
            },
        },
    },
});
