export type TeamRole = "owner" | "admin" | "member";

const ROLE_RANK: Record<TeamRole, number> = {
    member: 0,
    admin: 1,
    owner: 2,
};

export const ROLE_LABELS: Record<TeamRole, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
};

export interface RoleChange {
    memberName: string;
    fromRole: TeamRole;
    toRole: TeamRole;
    /** The member being changed is the signed-in user. */
    isSelf: boolean;
}

export interface RoleChangeConfirmation {
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: "primary" | "warning" | "error";
}

/**
 * Role changes that are hard to undo need an explicit confirmation:
 * promoting someone else to Owner (they gain full control, including
 * deleting the team and demoting you), and lowering your own role (you
 * may not be able to restore it yourself). Everything else applies directly.
 */
export function roleChangeConfirmation({
    memberName,
    fromRole,
    toRole,
    isSelf,
}: RoleChange): RoleChangeConfirmation | null {
    if (fromRole === toRole) return null;

    if (isSelf && ROLE_RANK[toRole] < ROLE_RANK[fromRole]) {
        return {
            title: `Change your role to ${ROLE_LABELS[toRole]}?`,
            message:
                toRole === "member"
                    ? "You'll lose access to team settings, integrations and member management. Another owner will have to give it back."
                    : "You'll no longer be able to manage owners or delete the team. Another owner will have to make you an owner again.",
            confirmLabel: `Become ${ROLE_LABELS[toRole].toLowerCase()}`,
            confirmColor: "warning",
        };
    }

    if (toRole === "owner") {
        return {
            title: `Make ${memberName} an owner?`,
            message: `Owners have full control of this team: they can manage other owners, change any role and delete the team. ${memberName} could remove your access.`,
            confirmLabel: "Make owner",
            confirmColor: "warning",
        };
    }

    return null;
}
