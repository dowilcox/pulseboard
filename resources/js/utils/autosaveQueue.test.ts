import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutosaveQueue, type AutosavePayload } from "./autosaveQueue";

interface Deferred {
    payload: AutosavePayload;
    resolve: () => void;
    reject: (error: unknown) => void;
}

/** A send() whose calls are recorded and settled manually by the test. */
function controlledSend() {
    const calls: Deferred[] = [];
    const send = vi.fn(
        (payload: AutosavePayload) =>
            new Promise<void>((resolve, reject) => {
                calls.push({ payload, resolve, reject });
            }),
    );
    return { send, calls };
}

/** Let pending promise continuations run (timers are faked). */
async function tick() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("AutosaveQueue", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("debounces a field and sends only the latest value", async () => {
        const { send, calls } = controlledSend();
        const queue = new AutosaveQueue({ send });

        queue.schedule("title", "a", 600);
        vi.advanceTimersByTime(300);
        queue.schedule("title", "ab", 600);
        expect(queue.status).toBe("saving");
        expect(queue.isBusy("title")).toBe(true);

        vi.advanceTimersByTime(599);
        expect(send).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(calls.map((c) => c.payload)).toEqual([{ title: "ab" }]);

        calls[0].resolve();
        await vi.waitFor(() => expect(queue.status).toBe("saved"));
        expect(queue.isBusy("title")).toBe(false);
        expect(queue.hasUnsaved()).toBe(false);
    });

    it("flush sends pending fields immediately in one batch", async () => {
        const { send, calls } = controlledSend();
        const queue = new AutosaveQueue({ send });

        queue.schedule("title", "New", 600);
        queue.schedule("checklists", [], 800);

        const flushed = queue.flush();
        expect(calls).toHaveLength(1);
        expect(calls[0].payload).toEqual({ title: "New", checklists: [] });

        calls[0].resolve();
        await expect(flushed).resolves.toBeUndefined();

        // The debounce timers were consumed by the flush.
        vi.advanceTimersByTime(1000);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("flush resolves immediately when nothing is pending", async () => {
        const { send } = controlledSend();
        const queue = new AutosaveQueue({ send });

        await expect(queue.flush()).resolves.toBeUndefined();
        expect(send).not.toHaveBeenCalled();
        expect(queue.status).toBe("idle");
    });

    it("sends one batch at a time so saves land in order", async () => {
        const { send, calls } = controlledSend();
        const queue = new AutosaveQueue({ send });

        void queue.saveNow({ title: "one" });
        void queue.saveNow({ title: "two" });
        void queue.saveNow({ due_date: "2026-01-02" });

        expect(calls).toHaveLength(1);
        expect(calls[0].payload).toEqual({ title: "one" });

        calls[0].resolve();
        await vi.waitFor(() => expect(calls).toHaveLength(2));
        expect(calls[1].payload).toEqual({
            title: "two",
            due_date: "2026-01-02",
        });
        calls[1].resolve();
        await vi.waitFor(() => expect(queue.status).toBe("saved"));
        expect(send).toHaveBeenCalledTimes(2);
    });

    it("keeps a failed batch and retries it with the next flush", async () => {
        const onError = vi.fn();
        const { send, calls } = controlledSend();
        const queue = new AutosaveQueue({ send, onError });

        const first = queue.saveNow({ title: "Draft" });
        calls[0].reject(new Error("offline"));
        await expect(first).rejects.toThrow("offline");

        expect(queue.status).toBe("error");
        expect(queue.error).toBeInstanceOf(Error);
        expect(queue.isBusy("title")).toBe(true);
        // Failed values don't block navigation once reported.
        expect(queue.hasUnsaved()).toBe(false);
        expect(onError).toHaveBeenCalledTimes(1);

        const retry = queue.flush();
        expect(calls[1].payload).toEqual({ title: "Draft" });
        calls[1].resolve();
        await expect(retry).resolves.toBeUndefined();
        expect(queue.status).toBe("saved");
        expect(queue.error).toBeNull();
    });

    it("merges a failed batch under newer values on the next save", async () => {
        const { send, calls } = controlledSend();
        const queue = new AutosaveQueue({ send });

        void queue.saveNow({ title: "Old", due_date: null }).catch(() => {});
        calls[0].reject(new Error("500"));
        await tick();

        queue.schedule("title", "Newer", 600);
        vi.advanceTimersByTime(600);
        expect(calls[1].payload).toEqual({ title: "Newer", due_date: null });
    });

    it("takeUnsent returns scheduled, ready and failed values and clears them", async () => {
        const { send, calls } = controlledSend();
        const queue = new AutosaveQueue({ send });

        void queue.saveNow({ links: [] }).catch(() => {});
        calls[0].reject(new Error("nope"));
        await tick();

        queue.schedule("title", "Unsent", 600);

        expect(queue.takeUnsent()).toEqual({ links: [], title: "Unsent" });
        expect(queue.takeUnsent()).toBeNull();
        expect(queue.isBusy("title")).toBe(false);

        // The cleared debounce never fires.
        vi.advanceTimersByTime(1000);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("cancel drops an unsent field without touching others", () => {
        const { send, calls } = controlledSend();
        const queue = new AutosaveQueue({ send });

        queue.schedule("title", "typo", 600);
        queue.schedule("effort_estimate", 3, 600);
        queue.cancel("title");

        vi.advanceTimersByTime(600);
        expect(calls.map((c) => c.payload)).toEqual([{ effort_estimate: 3 }]);
    });

    it("discard drops everything and resolves waiting flushes", async () => {
        const { send } = controlledSend();
        const queue = new AutosaveQueue({ send });

        queue.schedule("title", "gone", 600);
        queue.discard();

        vi.advanceTimersByTime(600);
        expect(send).not.toHaveBeenCalled();
        expect(queue.hasUnsaved()).toBe(false);
        await expect(queue.flush()).resolves.toBeUndefined();
    });

    it("calls onIdle after a successful save once nothing else is pending", async () => {
        const onIdle = vi.fn();
        const { send, calls } = controlledSend();
        const queue = new AutosaveQueue({ send, onIdle });

        void queue.saveNow({ title: "A" });
        queue.schedule("due_date", "2026-02-01", 600);

        calls[0].resolve();
        await tick();
        // A debounced change is still waiting, so don't refresh yet.
        expect(onIdle).not.toHaveBeenCalled();

        vi.advanceTimersByTime(600);
        calls[1].resolve();
        await vi.waitFor(() => expect(onIdle).toHaveBeenCalledTimes(1));
    });
});
