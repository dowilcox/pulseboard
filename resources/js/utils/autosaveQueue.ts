export type AutosavePayload = Record<string, unknown>;

/**
 * - idle:   nothing has been saved (or changed) yet on this page
 * - saving: a change is waiting for its debounce or a request is in flight
 * - saved:  everything has been persisted
 * - error:  the last attempt failed; the values are kept for a retry
 */
export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveQueueOptions {
    /** Persist a batch of field changes. Reject to mark the batch as failed. */
    send: (payload: AutosavePayload) => Promise<void>;
    /** Called whenever the status or the set of busy fields may have changed. */
    onChange?: () => void;
    /** Called after a successful save once nothing else is waiting to be sent. */
    onIdle?: () => void;
    /** Called when a batch fails to save. */
    onError?: (error: unknown) => void;
}

interface Waiter {
    resolve: () => void;
    reject: (error: unknown) => void;
}

interface ScheduledField {
    value: unknown;
    timer: ReturnType<typeof setTimeout>;
}

function isEmpty(payload: AutosavePayload): boolean {
    return Object.keys(payload).length === 0;
}

/**
 * Debounced, ordered field autosave.
 *
 * Fields are debounced individually, then sent one batch at a time so an
 * older value can never land after a newer one. Pending saves are flushed —
 * never dropped — when the caller asks (navigation, unmount, unload), and a
 * failed batch is kept and retried with the next save.
 */
export class AutosaveQueue {
    private scheduled = new Map<string, ScheduledField>();
    private ready: AutosavePayload = {};
    private inFlight: AutosavePayload | null = null;
    private failed: AutosavePayload | null = null;
    private lastError: unknown = null;
    private savedOnce = false;
    private waiters: Waiter[] = [];

    constructor(private readonly options: AutosaveQueueOptions) {}

    /** Queue `value` for `field`, sending it after `delay` ms of quiet. */
    schedule(field: string, value: unknown, delay: number): void {
        const existing = this.scheduled.get(field);
        if (existing) clearTimeout(existing.timer);
        // The newer value supersedes anything not yet sent for this field.
        delete this.ready[field];

        const timer = setTimeout(() => {
            const entry = this.scheduled.get(field);
            if (!entry) return;
            this.scheduled.delete(field);
            this.ready[field] = entry.value;
            void this.drain();
        }, delay);

        this.scheduled.set(field, { value, timer });
        this.notify();
    }

    /** Send `payload` right away (together with anything else pending). */
    saveNow(payload: AutosavePayload): Promise<void> {
        for (const field of Object.keys(payload)) {
            this.clearScheduled(field);
        }
        Object.assign(this.ready, payload);
        return this.flush();
    }

    /**
     * Send everything pending (including a previously failed batch) without
     * waiting for debounces. Resolves once it is all saved; rejects if the
     * save fails.
     */
    flush(): Promise<void> {
        for (const [field, entry] of this.scheduled) {
            clearTimeout(entry.timer);
            this.ready[field] = entry.value;
        }
        this.scheduled.clear();

        const promise = new Promise<void>((resolve, reject) => {
            this.waiters.push({ resolve, reject });
        });
        void this.drain();
        this.settle();
        this.notify();
        return promise;
    }

    /** Drop any unsent value for `field` (e.g. the user reverted an edit). */
    cancel(field: string): void {
        this.clearScheduled(field);
        delete this.ready[field];
        if (this.failed) {
            delete this.failed[field];
            if (isEmpty(this.failed)) this.failed = null;
        }
        this.settle();
        this.notify();
    }

    /** Drop everything that has not been sent yet. */
    discard(): void {
        for (const entry of this.scheduled.values()) clearTimeout(entry.timer);
        this.scheduled.clear();
        this.ready = {};
        this.failed = null;
        this.settle();
        this.notify();
    }

    /**
     * Remove and return everything not yet sent, for a last-chance send
     * (e.g. a keepalive request while the page unloads).
     */
    takeUnsent(): AutosavePayload | null {
        const payload: AutosavePayload = {
            ...(this.failed ?? {}),
            ...this.ready,
        };
        for (const [field, entry] of this.scheduled) {
            clearTimeout(entry.timer);
            payload[field] = entry.value;
        }
        this.scheduled.clear();
        this.ready = {};
        this.failed = null;
        return isEmpty(payload) ? null : payload;
    }

    /** True while `field` has a local value the server doesn't have yet. */
    isBusy(field: string): boolean {
        return (
            this.scheduled.has(field) ||
            field in this.ready ||
            (this.inFlight !== null && field in this.inFlight) ||
            (this.failed !== null && field in this.failed)
        );
    }

    /** True while a change is waiting to be sent or is being sent. */
    hasUnsaved(): boolean {
        return (
            this.scheduled.size > 0 ||
            !isEmpty(this.ready) ||
            this.inFlight !== null
        );
    }

    get status(): AutosaveStatus {
        if (this.hasUnsaved()) return "saving";
        if (this.failed) return "error";
        return this.savedOnce ? "saved" : "idle";
    }

    get error(): unknown {
        return this.failed ? this.lastError : null;
    }

    /** Stop pending timers without sending (use `takeUnsent` first). */
    dispose(): void {
        for (const entry of this.scheduled.values()) clearTimeout(entry.timer);
        this.scheduled.clear();
    }

    private clearScheduled(field: string): void {
        const entry = this.scheduled.get(field);
        if (entry) {
            clearTimeout(entry.timer);
            this.scheduled.delete(field);
        }
    }

    private async drain(): Promise<void> {
        if (this.inFlight) return;

        const payload: AutosavePayload = {
            ...(this.failed ?? {}),
            ...this.ready,
        };
        if (isEmpty(payload)) return;

        this.ready = {};
        this.failed = null;
        this.inFlight = payload;
        this.notify();

        let ok = true;
        try {
            await this.options.send(payload);
            this.savedOnce = true;
            this.lastError = null;
        } catch (error) {
            ok = false;
            // Keep the values; anything newer in `ready` wins on the next send.
            this.failed = payload;
            this.lastError = error;
            this.options.onError?.(error);
        }

        this.inFlight = null;

        if (!isEmpty(this.ready)) {
            void this.drain();
            return;
        }

        this.settle();
        this.notify();
        if (ok && this.scheduled.size === 0) this.options.onIdle?.();
    }

    /** Resolve/reject flush() callers once nothing is queued or in flight. */
    private settle(): void {
        if (this.inFlight || !isEmpty(this.ready)) return;
        if (this.waiters.length === 0) return;

        const waiters = this.waiters;
        this.waiters = [];
        for (const waiter of waiters) {
            if (this.failed) waiter.reject(this.lastError);
            else waiter.resolve();
        }
    }

    private notify(): void {
        this.options.onChange?.();
    }
}
