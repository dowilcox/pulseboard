import {
    useKeyboardShortcuts,
    useShortcutHint,
} from "@/Contexts/KeyboardShortcutsContext";
import { harbor } from "@/theme/harbor";
import KeyboardIcon from "@mui/icons-material/KeyboardOutlined";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

/** App bar entry point for the keyboard shortcut overlay. */
export default function KeyboardShortcutsButton() {
    const { openHelp, apple } = useKeyboardShortcuts();
    const hint = useShortcutHint("?") || modSlashHint(apple);

    return (
        <Tooltip title={`Keyboard shortcuts (${hint})`}>
            <IconButton
                size="small"
                onClick={openHelp}
                aria-label="Keyboard shortcuts"
                aria-haspopup="dialog"
                aria-keyshortcuts={`? ${apple ? "Meta" : "Control"}+/`}
                sx={{
                    color: harbor.sub,
                    // The account menu offers it too; phones rarely have a
                    // keyboard, so keep their app bar uncluttered.
                    display: { xs: "none", sm: "inline-flex" },
                }}
            >
                <KeyboardIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
}

function modSlashHint(apple: boolean): string {
    return apple ? "⌘/" : "Ctrl+/";
}
