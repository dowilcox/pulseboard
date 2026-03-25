import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { PageProps } from "@/types";
import { Head, Link as InertiaLink, usePage } from "@inertiajs/react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

interface Props {
    status: number;
}

const titles: Record<number, string> = {
    403: "Forbidden",
    404: "Not Found",
    500: "Server Error",
    503: "Service Unavailable",
};

const descriptions: Record<number, string> = {
    403: "You don't have permission to access this page.",
    404: "The page you're looking for doesn't exist or has been moved.",
    500: "Something went wrong on our end. Please try again later.",
    503: "We're temporarily offline for maintenance. Please check back soon.",
};

export default function Error({ status }: Props) {
    const { auth } = usePage<PageProps>().props;
    const title = titles[status] ?? "Error";
    const description = descriptions[status] ?? "An unexpected error occurred.";

    const content = (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
                textAlign: "center",
                px: 3,
            }}
        >
            <Typography
                variant="h1"
                sx={{
                    fontSize: { xs: "4rem", md: "6rem" },
                    fontWeight: 700,
                    color: "text.disabled",
                    lineHeight: 1,
                }}
            >
                {status}
            </Typography>
            <Typography variant="h5" sx={{ mt: 2, fontWeight: 600 }}>
                {title}
            </Typography>
            <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1, maxWidth: 400 }}
            >
                {description}
            </Typography>
            <Box sx={{ display: "flex", gap: 2, mt: 4 }}>
                <Button
                    variant="outlined"
                    onClick={() => window.history.back()}
                >
                    Go Back
                </Button>
                <Button
                    variant="contained"
                    component={InertiaLink}
                    href={auth?.user ? "/dashboard" : "/"}
                >
                    {auth?.user ? "Dashboard" : "Home"}
                </Button>
            </Box>
        </Box>
    );

    if (auth?.user) {
        return (
            <AuthenticatedLayout>
                <Head title={title} />
                {content}
            </AuthenticatedLayout>
        );
    }

    return (
        <>
            <Head title={title} />
            {content}
        </>
    );
}
