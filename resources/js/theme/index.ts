import { createTheme } from "@mui/material/styles";
import { harbor, harborHex } from "./harbor";

/**
 * Harbor theme — mid-tone blue-slate canvas, cream shadow-only cards,
 * indigo accent with copper warmth. Tokens in ./harbor.ts.
 */
export const harborTheme = createTheme({
    typography: {
        fontFamily: harbor.bodyFont,
        h1: { fontFamily: harbor.headingFont, fontWeight: 800 },
        h2: { fontFamily: harbor.headingFont, fontWeight: 800 },
        h3: { fontFamily: harbor.headingFont, fontWeight: 800 },
        h4: {
            fontFamily: harbor.headingFont,
            fontWeight: 800,
            letterSpacing: "-0.01em",
        },
        h5: {
            fontFamily: harbor.headingFont,
            fontWeight: 800,
            letterSpacing: "-0.01em",
        },
        h6: {
            fontFamily: harbor.headingFont,
            fontWeight: 700,
            letterSpacing: "-0.01em",
        },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 700 },
        button: { fontWeight: 700 },
    },
    shape: {
        borderRadius: 12,
    },
    palette: {
        mode: "light",
        primary: {
            main: harborHex.accent,
            light: harborHex.accentLight,
            dark: harborHex.accentDark,
            contrastText: "#ffffff",
        },
        secondary: {
            main: harborHex.secondary,
            contrastText: "#ffffff",
        },
        success: {
            main: harborHex.success,
            contrastText: "#ffffff",
        },
        warning: {
            main: harborHex.secondary,
            contrastText: "#ffffff",
        },
        error: {
            main: harborHex.danger,
            dark: harborHex.dangerText,
            contrastText: "#ffffff",
        },
        background: {
            default: harborHex.canvas,
            paper: harborHex.card,
        },
        text: {
            primary: harborHex.ink,
            secondary: harborHex.sub,
        },
        divider: harborHex.cardBorder,
        action: {
            hover: "rgba(34, 41, 53, 0.05)",
            selected: "rgba(57, 89, 166, 0.12)",
            focus: "rgba(57, 89, 166, 0.18)",
            disabled: "rgba(77, 86, 98, 0.38)",
            disabledBackground: "rgba(77, 86, 98, 0.12)",
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    background: harbor.canvas,
                    color: harbor.ink,
                },
                "*:focus-visible": {
                    outline: `2px solid ${harborHex.accent}`,
                    outlineOffset: 2,
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
                    borderRadius: harbor.radius.control,
                    fontWeight: 700,
                },
                outlinedPrimary: {
                    borderWidth: 1.5,
                    "&:hover": {
                        borderWidth: 1.5,
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                    backgroundColor: harbor.card,
                },
                rounded: {
                    borderRadius: harbor.radius.panel,
                },
                elevation1: {
                    boxShadow: harbor.cardShadow,
                },
                elevation2: {
                    boxShadow: harbor.cardShadow,
                },
                elevation3: {
                    boxShadow: harbor.cardShadowHover,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: harbor.radius.panel,
                    boxShadow: harbor.cardShadow,
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: harbor.radius.panel,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 700,
                    borderRadius: harbor.radius.pill,
                },
                sizeSmall: {
                    height: 22,
                    fontSize: 11,
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
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                    backgroundColor: harbor.canvas,
                    color: harbor.ink,
                    borderColor: "transparent",
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: harbor.canvas,
                    backgroundImage: "none",
                    borderRight: "none",
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: harbor.countBg,
                    borderRadius: harbor.radius.control,
                    "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "transparent",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: harbor.faint,
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: harborHex.accent,
                        borderWidth: 2,
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    "&.Mui-focused": {
                        color: harborHex.accent,
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                root: {
                    borderRadius: harbor.radius.control,
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    "& .MuiTableCell-head": {
                        fontWeight: 700,
                        fontSize: "0.6875rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: harbor.faint,
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderColor: harbor.cardBorder,
                },
            },
        },
        MuiLink: {
            styleOverrides: {
                root: {
                    color: harborHex.accent,
                    fontWeight: 600,
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: harborHex.ink,
                    fontWeight: 600,
                },
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: {
                    boxShadow: harbor.cardShadowHover,
                    borderRadius: harbor.radius.card,
                },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                root: {
                    backgroundColor: harbor.track,
                    borderRadius: 3,
                    height: 6,
                },
                bar: {
                    borderRadius: 3,
                },
            },
        },
        MuiAvatar: {
            styleOverrides: {
                root: {
                    fontWeight: 700,
                },
            },
        },
    },
});
