import { Link } from "@inertiajs/react";
import { type PropsWithChildren } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Logo from "@/Components/Common/Logo";

export default function GuestLayout({ children }: PropsWithChildren) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                bgcolor: "background.default",
                px: 2,
            }}
        >
            <Box sx={{ mb: 4 }}>
                <Link href="/" style={{ textDecoration: "none" }}>
                    <Logo size="medium" showText />
                </Link>
            </Box>

            <Box component="main">
                <Paper
                    elevation={2}
                    sx={{
                        width: "100%",
                        maxWidth: 440,
                        px: 4,
                        py: 4,
                        borderRadius: 1.5,
                    }}
                >
                    {children}
                </Paper>
            </Box>
        </Box>
    );
}
