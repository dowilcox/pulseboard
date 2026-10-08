import { harbor } from "@/theme/harbor";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { type ReactNode, useId } from "react";

interface SectionCardProps {
    title: ReactNode;
    /** Heading level for the title; settings sections sit directly under the page h1. */
    headingLevel?: "h2" | "h3";
    description?: ReactNode;
    /** Controls shown beside the title (e.g. an "Add" button). */
    action?: ReactNode;
    tone?: "default" | "danger";
    children?: ReactNode;
}

/**
 * A titled settings card rendered as a labelled <section>, so the page keeps
 * a logical h1 → h2 → h3 outline.
 */
export default function SectionCard({
    title,
    headingLevel = "h2",
    description,
    action,
    tone = "default",
    children,
}: SectionCardProps) {
    const headingId = useId();

    return (
        <Card
            variant="outlined"
            component="section"
            aria-labelledby={headingId}
            sx={tone === "danger" ? { borderColor: "error.main" } : undefined}
        >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 1.5,
                        mb: children ? 2 : 0,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: "1 1 240px" }}>
                        <Typography
                            id={headingId}
                            component={headingLevel}
                            variant={
                                headingLevel === "h2"
                                    ? "subtitle1"
                                    : "subtitle2"
                            }
                            fontWeight={700}
                            color={tone === "danger" ? "error" : undefined}
                            sx={{ lineHeight: 1.4 }}
                        >
                            {title}
                        </Typography>
                        {description && (
                            <Typography
                                variant="body2"
                                sx={{ color: harbor.sub, mt: 0.25 }}
                            >
                                {description}
                            </Typography>
                        )}
                    </Box>
                    {action && (
                        <Box
                            sx={{
                                display: "flex",
                                gap: 1,
                                flexWrap: "wrap",
                                flexShrink: 0,
                            }}
                        >
                            {action}
                        </Box>
                    )}
                </Box>
                {children}
            </CardContent>
        </Card>
    );
}
