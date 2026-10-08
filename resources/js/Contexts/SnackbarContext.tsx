import { usePage, router } from "@inertiajs/react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import type { PageProps } from "@/types";

type Severity = "success" | "error" | "warning" | "info";

interface SnackbarMessage {
    message: string;
    severity: Severity;
    key: number;
}

interface SnackbarContextValue {
    showSnackbar: (message: string, severity?: Severity) => void;
}

const SnackbarContext = createContext<SnackbarContextValue>({
    showSnackbar: () => {},
});

export function useSnackbar() {
    return useContext(SnackbarContext);
}

export function SnackbarProvider({ children }: PropsWithChildren) {
    const [queue, setQueue] = useState<SnackbarMessage[]>([]);
    const [current, setCurrent] = useState<SnackbarMessage | null>(null);
    const [open, setOpen] = useState(false);
    const shownFlashRef = useRef<string | null>(null);
    const shownErrorsRef = useRef<string | null>(null);

    const showSnackbar = useCallback(
        (message: string, severity: Severity = "error") => {
            setQueue((prev) => [
                ...prev,
                { message, severity, key: Date.now() },
            ]);
        },
        [],
    );

    // Process queue
    useEffect(() => {
        if (queue.length > 0 && !current) {
            setCurrent(queue[0]);
            setQueue((prev) => prev.slice(1));
            setOpen(true);
        }
    }, [queue, current]);

    // Watch flash messages from Inertia shared props
    const pageProps = usePage<PageProps>().props;
    const flash = pageProps.flash;

    // A new full visit may legitimately flash the same message again (e.g.
    // saving the same section twice), so forget the last flash whenever one
    // starts. Partial reloads keep stale shared props, so they don't reset.
    useEffect(() => {
        return router.on("start", (event) => {
            if (event.detail.visit.only.length === 0) {
                shownFlashRef.current = null;
            }
        });
    }, []);

    useEffect(() => {
        const flashKey = `${flash?.success ?? ""}|${flash?.error ?? ""}`;
        if (flashKey === shownFlashRef.current) return;
        shownFlashRef.current = flashKey;

        if (flash?.success) {
            showSnackbar(flash.success, "success");
        }
        if (flash?.error) {
            showSnackbar(flash.error, "error");
        }
    }, [flash, showSnackbar]);

    // Watch Inertia validation errors — show the first error as a snackbar
    useEffect(() => {
        const removeListener = router.on("httpException", (event) => {
            // Inertia fires "httpException" for non-Inertia responses and for
            // Inertia responses with a 4xx/5xx status. Let the latter render
            // (that's the Error page), skip anything already handled (e.g. the
            // 419 reload in bootstrap.ts), and show a generic message otherwise.
            if (
                event.defaultPrevented ||
                event.detail.response.headers["x-inertia"]
            ) {
                return;
            }
            showSnackbar("Something went wrong. Please try again.", "error");
            event.preventDefault();
        });

        return removeListener;
    }, [showSnackbar]);

    // Watch for validation errors on page props
    const errors = usePage().props.errors as Record<string, string> | undefined;

    useEffect(() => {
        if (!errors || Object.keys(errors).length === 0) return;

        const errKey = JSON.stringify(errors);
        if (errKey === shownErrorsRef.current) return;
        shownErrorsRef.current = errKey;

        const firstError = Object.values(errors)[0];
        if (firstError) {
            showSnackbar(firstError, "error");
        }
    }, [errors, showSnackbar]);

    const handleClose = (
        _event?: React.SyntheticEvent | Event,
        reason?: string,
    ) => {
        if (reason === "clickaway") return;
        setOpen(false);
    };

    const handleExited = () => {
        setCurrent(null);
    };

    return (
        <SnackbarContext.Provider value={{ showSnackbar }}>
            {children}
            <Snackbar
                open={open}
                autoHideDuration={6000}
                onClose={handleClose}
                TransitionProps={{ onExited: handleExited }}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                {current ? (
                    <Alert
                        onClose={handleClose}
                        severity={current.severity}
                        variant="filled"
                        sx={{ width: "100%" }}
                    >
                        {current.message}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </SnackbarContext.Provider>
    );
}
