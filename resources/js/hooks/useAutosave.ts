import { useWebSocket } from "@/Contexts/WebSocketContext";
import {
    AutosaveQueue,
    type AutosavePayload,
    type AutosaveStatus,
} from "@/utils/autosaveQueue";
import type { PendingVisit } from "@inertiajs/core";
import { router } from "@inertiajs/react";
import { useEffect, useReducer, useRef, useState } from "react";

export class AutosaveError extends Error {}

/** Keepalive request bodies are capped at 64KB by the fetch spec. */
const KEEPALIVE_MAX_BODY = 60_000;

function csrfHeaders(): Record<string, string> {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    if (match) return { "X-XSRF-TOKEN": decodeURIComponent(match[1]) };

    const meta = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    )?.content;
    return meta ? { "X-CSRF-TOKEN": meta } : {};
}

function firstErrorMessage(data: unknown): string | null {
    if (!data || typeof data !== "object") return null;
    const { errors, message } = data as {
        errors?: Record<string, string[] | string>;
        message?: string;
    };
    if (errors) {
        const first = Object.values(errors)[0];
        const text = Array.isArray(first) ? first[0] : first;
        if (text) return text;
    }
    return message ?? null;
}

/**
 * PUT a partial update as JSON with `fetch`, outside Inertia's request
 * streams: Inertia cancels in-flight visits on navigation, while a
 * keepalive fetch survives both client-side navigation and page unload.
 *
 * The web update endpoints answer with a redirect, so redirects are not
 * followed — an opaque redirect means the update was accepted. Validation
 * failures come back as 422 JSON because the request accepts JSON.
 */
export async function sendJsonUpdate(
    url: string,
    payload: AutosavePayload,
    socketId?: string | null,
): Promise<void> {
    const body = JSON.stringify(payload);

    let response: Response;
    try {
        response = await fetch(url, {
            method: "PUT",
            credentials: "same-origin",
            redirect: "manual",
            keepalive: body.length < KEEPALIVE_MAX_BODY,
            headers: {
                ...csrfHeaders(),
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
                ...(socketId ? { "X-Socket-ID": socketId } : {}),
            },
            body,
        });
    } catch {
        throw new AutosaveError(
            "Couldn't save your changes. Check your connection.",
        );
    }

    if (response.type === "opaqueredirect" || response.ok) return;

    if (response.status === 419) {
        throw new AutosaveError(
            "Your session expired. Reload the page to keep editing.",
        );
    }

    let message: string | null = null;
    try {
        message = firstErrorMessage(await response.json());
    } catch {
        // Non-JSON error body — fall back to a generic message.
    }
    throw new AutosaveError(
        message ?? `Couldn't save your changes (error ${response.status}).`,
    );
}

/**
 * True for Inertia visits that leave the current page (as opposed to saves,
 * prefetches, partial reloads and deferred-prop loads on the same URL).
 */
export function isLeavingVisit(visit: PendingVisit): boolean {
    if (visit.method !== "get" || visit.prefetch) return false;
    return visit.url.pathname !== window.location.pathname;
}

/** Re-issue an Inertia visit that was cancelled from a `before` listener. */
export function reissueVisit(visit: PendingVisit): void {
    router.visit(visit.url.href, {
        method: visit.method,
        data: visit.data,
        replace: visit.replace,
        preserveScroll: visit.preserveScroll,
        preserveState: visit.preserveState,
        only: visit.only,
        except: visit.except,
        headers: visit.headers,
        errorBag: visit.errorBag,
        forceFormData: visit.forceFormData,
        queryStringArrayFormat: visit.queryStringArrayFormat,
        async: visit.async,
        showProgress: visit.showProgress,
        fresh: visit.fresh,
        reset: visit.reset,
        preserveUrl: visit.preserveUrl,
        viewTransition: visit.viewTransition,
    });
}

export interface Autosave {
    status: AutosaveStatus;
    /** Message from the last failed save, when `status` is "error". */
    errorMessage: string | null;
    /** Debounce `value` for `field` and save it after `delay` ms. */
    schedule: (field: string, value: unknown, delay?: number) => void;
    /** Save these fields now (with anything else pending). */
    saveNow: (payload: AutosavePayload) => Promise<void>;
    /** Save everything pending now. Rejects if the save fails. */
    flush: () => Promise<void>;
    /** Retry a failed save. */
    retry: () => void;
    /** Drop an unsent value for one field. */
    cancel: (field: string) => void;
    /** Drop every unsent value (e.g. before deleting the record). */
    discard: () => void;
    /** True while `field` has a local value the server doesn't have yet. */
    isBusy: (field: string) => boolean;
}

interface UseAutosaveOptions {
    /** Endpoint the fields are PUT to; read at send time so it may change. */
    url: string;
    /** Called once a save lands and nothing else is pending. */
    onSaved?: () => void;
    /** Called with a user-facing message when a save fails. */
    onError?: (message: string) => void;
}

const DEFAULT_DELAY = 600;

/**
 * Reliable debounced autosave for a record's fields.
 *
 * Pending changes are flushed — not cancelled — before Inertia navigates
 * away (the visit waits for the save, then continues), when the component
 * unmounts, and when the tab is hidden or closed.
 */
export function useAutosave({
    url,
    onSaved,
    onError,
}: UseAutosaveOptions): Autosave {
    const { echo } = useWebSocket();
    const [, rerender] = useReducer((n: number) => n + 1, 0);

    const mountedRef = useRef(true);
    const urlRef = useRef(url);
    const echoRef = useRef(echo);
    const onSavedRef = useRef(onSaved);
    const onErrorRef = useRef(onError);
    useEffect(() => {
        urlRef.current = url;
        echoRef.current = echo;
        onSavedRef.current = onSaved;
        onErrorRef.current = onError;
    });

    const [queue] = useState(() => {
        const send = (payload: AutosavePayload) => {
            let socketId: string | null = null;
            // Once the page has unmounted (e.g. browser Back to the board),
            // let the broadcast reach this tab too: the board page that is
            // now showing loaded its data before this save landed.
            if (mountedRef.current) {
                try {
                    socketId = echoRef.current?.socketId() ?? null;
                } catch {
                    socketId = null;
                }
            }
            return sendJsonUpdate(urlRef.current, payload, socketId);
        };
        const instance = new AutosaveQueue({
            send,
            onChange: rerender,
            onIdle: () => {
                if (mountedRef.current) onSavedRef.current?.();
            },
            onError: (error) =>
                onErrorRef.current?.(
                    error instanceof Error
                        ? error.message
                        : "Couldn't save your changes.",
                ),
        });
        return Object.assign(instance, { sendDirect: send });
    });

    // Hold Inertia navigation until pending saves land, then continue it.
    useEffect(() => {
        let blockedVisit: PendingVisit | null = null;

        return router.on("before", (event) => {
            if (event.defaultPrevented) return;
            const visit = event.detail.visit;
            if (!isLeavingVisit(visit) || !queue.hasUnsaved()) return;

            blockedVisit = visit;
            queue.flush().then(
                () => {
                    const next = blockedVisit;
                    blockedVisit = null;
                    if (next) reissueVisit(next);
                },
                () => {
                    // Stay on the page; the status shows "Couldn't save".
                    blockedVisit = null;
                },
            );
            return false;
        });
    }, [queue]);

    // Tab hidden or closing: send what's left with a keepalive request.
    useEffect(() => {
        const sendUnsent = () => {
            const payload = queue.takeUnsent();
            if (payload) void queue.sendDirect(payload).catch(() => {});
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden" && queue.hasUnsaved()) {
                void queue.flush().catch(() => {});
            }
        };

        window.addEventListener("beforeunload", sendUnsent);
        window.addEventListener("pagehide", sendUnsent);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("beforeunload", sendUnsent);
            window.removeEventListener("pagehide", sendUnsent);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [queue]);

    // Unmount (e.g. browser back): flush rather than drop pending changes.
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            const payload = queue.takeUnsent();
            if (payload) void queue.sendDirect(payload).catch(() => {});
            queue.dispose();
        };
    }, [queue]);

    const error = queue.error;

    return {
        status: queue.status,
        errorMessage:
            error instanceof Error
                ? error.message
                : error
                  ? String(error)
                  : null,
        schedule: (field, value, delay = DEFAULT_DELAY) =>
            queue.schedule(field, value, delay),
        saveNow: (payload) => queue.saveNow(payload),
        flush: () => queue.flush(),
        retry: () => void queue.flush().catch(() => {}),
        cancel: (field) => queue.cancel(field),
        discard: () => queue.discard(),
        isBusy: (field) => queue.isBusy(field),
    };
}
