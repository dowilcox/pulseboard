import { useEffect, useRef } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { replaceAll } from "@milkdown/kit/utils";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "@milkdown/crepe/theme/frame-dark.css";
import { useThemeMode } from "@/Contexts/ThemeContext";
import { getCrepeThemeVars, crepeHeadingSx } from "./crepeTheme";
import Box from "@mui/material/Box";

interface RichTextDisplayProps {
    content: string;
}

function CrepeDisplay({ content }: RichTextDisplayProps) {
    const [loading, getInstance] = useInstance();
    const prevContent = useRef(content);

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

    // Sync content changes after initial mount
    useEffect(() => {
        if (loading || content === prevContent.current) return;
        prevContent.current = content;
        const editor = getInstance();
        if (editor) editor.action(replaceAll(content));
    }, [content, loading, getInstance]);

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
                    ...getCrepeThemeVars(isDark, true),
                    border: "none",
                },
                "& .milkdown .editor h1, & .milkdown .editor h2, & .milkdown .editor h3, & .milkdown .editor h4, & .milkdown .editor h5, & .milkdown .editor h6":
                    crepeHeadingSx,
            }}
        >
            <MilkdownProvider>
                <CrepeDisplay content={content} />
            </MilkdownProvider>
        </Box>
    );
}
