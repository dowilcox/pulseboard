import { describe, expect, it } from "vitest";
import { roleChangeConfirmation } from "./roleChange";

describe("roleChangeConfirmation", () => {
    it("needs no confirmation when nothing changes", () => {
        expect(
            roleChangeConfirmation({
                memberName: "Bob",
                fromRole: "owner",
                toRole: "owner",
                isSelf: true,
            }),
        ).toBeNull();
    });

    it("needs no confirmation for ordinary changes to others", () => {
        expect(
            roleChangeConfirmation({
                memberName: "Bob",
                fromRole: "member",
                toRole: "admin",
                isSelf: false,
            }),
        ).toBeNull();
        expect(
            roleChangeConfirmation({
                memberName: "Bob",
                fromRole: "owner",
                toRole: "member",
                isSelf: false,
            }),
        ).toBeNull();
    });

    it("confirms promoting someone else to owner", () => {
        const result = roleChangeConfirmation({
            memberName: "Bob",
            fromRole: "admin",
            toRole: "owner",
            isSelf: false,
        });
        expect(result?.title).toBe("Make Bob an owner?");
        expect(result?.confirmLabel).toBe("Make owner");
    });

    it("confirms demoting yourself", () => {
        const toAdmin = roleChangeConfirmation({
            memberName: "Alice",
            fromRole: "owner",
            toRole: "admin",
            isSelf: true,
        });
        expect(toAdmin?.title).toBe("Change your role to Admin?");

        const toMember = roleChangeConfirmation({
            memberName: "Alice",
            fromRole: "admin",
            toRole: "member",
            isSelf: true,
        });
        expect(toMember?.title).toBe("Change your role to Member?");
        expect(toMember?.message).toMatch(/lose access/);
    });
});
