import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { darkTheme } from "@/theme";

export function ThemeContextProvider({ children }: { children: ReactNode }) {
    return <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>;
}
