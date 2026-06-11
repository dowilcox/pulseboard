import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { harborTheme } from "@/theme";

export function AppThemeProvider({ children }: { children: ReactNode }) {
    return <ThemeProvider theme={harborTheme}>{children}</ThemeProvider>;
}
