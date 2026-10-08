import { describe, expect, it } from "vitest";
import {
    availableSettingsTabs,
    resolveSettingsTab,
    type TeamSettingsCan,
} from "./settingsTabs";

const member: TeamSettingsCan = {
    updateTeam: false,
    manageMembers: false,
    manageAdmins: false,
    manageLabels: false,
    manageIntegrations: false,
    manageBots: false,
    deleteTeam: false,
};

const admin: TeamSettingsCan = {
    ...member,
    updateTeam: true,
    manageMembers: true,
    manageLabels: true,
    manageIntegrations: true,
    manageBots: true,
};

const owner: TeamSettingsCan = {
    ...admin,
    manageAdmins: true,
    deleteTeam: true,
};

describe("availableSettingsTabs", () => {
    it("gives members only the read-only sections", () => {
        expect(availableSettingsTabs(member)).toEqual([
            "general",
            "members",
            "labels",
        ]);
    });

    it("adds integrations and API for admins, but not the danger zone", () => {
        expect(availableSettingsTabs(admin)).toEqual([
            "general",
            "members",
            "labels",
            "integrations",
            "api",
        ]);
    });

    it("adds the danger zone for owners", () => {
        expect(availableSettingsTabs(owner)).toContain("danger");
    });
});

describe("resolveSettingsTab", () => {
    const ownerTabs = availableSettingsTabs(owner);
    const memberTabs = availableSettingsTabs(member);

    it("falls back to the first tab when nothing is requested", () => {
        expect(resolveSettingsTab(null, ownerTabs)).toBe("general");
        expect(resolveSettingsTab(undefined, ownerTabs)).toBe("general");
        expect(resolveSettingsTab("", ownerTabs)).toBe("general");
    });

    it("returns a requested tab the user can open", () => {
        expect(resolveSettingsTab("labels", memberTabs)).toBe("labels");
        expect(resolveSettingsTab("danger", ownerTabs)).toBe("danger");
    });

    it("is case and whitespace tolerant", () => {
        expect(resolveSettingsTab(" Members ", memberTabs)).toBe("members");
    });

    it("maps legacy page names to their new tab", () => {
        expect(resolveSettingsTab("gitlab", ownerTabs)).toBe("integrations");
        expect(resolveSettingsTab("figma", ownerTabs)).toBe("integrations");
        expect(resolveSettingsTab("bots", ownerTabs)).toBe("api");
    });

    it("falls back for tabs the user cannot open", () => {
        expect(resolveSettingsTab("danger", memberTabs)).toBe("general");
        expect(resolveSettingsTab("integrations", memberTabs)).toBe("general");
    });

    it("falls back for unknown tabs", () => {
        expect(resolveSettingsTab("nope", ownerTabs)).toBe("general");
    });
});
