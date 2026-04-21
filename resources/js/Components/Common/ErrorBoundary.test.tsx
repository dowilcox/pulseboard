import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function Boom(): ReactNode {
    throw new Error("boom");
}

describe("ErrorBoundary", () => {
    it("renders the fallback UI when a child throws", () => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);

        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );

        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Try Again" })).toBeVisible();

        consoleErrorSpy.mockRestore();
    });
});
