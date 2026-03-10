import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "@milkdown/crepe/theme/frame-dark.css";
import { useThemeMode } from "@/Contexts/ThemeContext";
import Box from "@mui/material/Box";

interface RichTextDisplayProps {
    content: string;
}

function CrepeDisplay({ content }: RichTextDisplayProps) {
    useEditor((root) => {
        const crepe = new Crepe({
            root,
            defaultValue: content,
            features: {
                [CrepeFeature.Latex]: false,
                [CrepeFeature.Toolbar]: false,
                [CrepeFeature.BlockEdit]: false,
                [CrepeFeature.Placeholder]: false,
                [CrepeFeature.ImageBlock]: false,
            },
        });

        crepe.setReadonly(true);

        return crepe;
    }, []);

    return <Milkdown />;
}

export default function RichTextDisplay({ content }: RichTextDisplayProps) {
    const { resolvedMode } = useThemeMode();
    const isDark = resolvedMode === "dark";

    if (!content) return null;

    return (
        <Box
            className={isDark ? "dark" : ""}
            sx={{
                "& .milkdown": {
                    "--crepe-color-background": "transparent",
                    "--crepe-color-on-background": isDark
                        ? "rgba(255,255,255,0.87)"
                        : "rgba(0,0,0,0.87)",
                    "--crepe-color-surface": isDark ? "#262626" : "#f5f5f5",
                    "--crepe-color-on-surface": isDark
                        ? "rgba(255,255,255,0.70)"
                        : "rgba(0,0,0,0.70)",
                    "--crepe-color-outline": isDark
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(0,0,0,0.12)",
                    "--crepe-color-primary": isDark ? "#818cf8" : "#6366f1",
                    "--crepe-color-inline-code": isDark
                        ? "#a5b4fc"
                        : "#6366f1",
                    "--crepe-color-inline-area": isDark
                        ? "#2b2b2b"
                        : "#e8e8e8",
                    "--crepe-font-title":
                        '"Inter", "Helvetica Neue", "Arial", sans-serif',
                    "--crepe-font-default":
                        '"Inter", "Helvetica Neue", "Arial", sans-serif',
                    "--crepe-font-code":
                        '"Fira Code", "JetBrains Mono", monospace',
                    border: "none",
                },
                "& .milkdown .editor h1, & .milkdown .editor h2, & .milkdown .editor h3, & .milkdown .editor h4, & .milkdown .editor h5, & .milkdown .editor h6":
                    {
                        "&:first-child": { marginTop: 0 },
                        marginTop: "12px",
                    },
            }}
        >
            <MilkdownProvider>
                <CrepeDisplay content={content} />
            </MilkdownProvider>
        </Box>
    );
}
