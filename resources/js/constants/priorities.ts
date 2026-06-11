// Harbor palette — see resources/js/theme/harbor.ts (harborHex mirrors)
export const PRIORITY_COLORS: Record<string, string> = {
    urgent: "#ba3535", // danger
    high: "#ac571d", // copper dot
    medium: "#3959a6", // indigo accent
    low: "#565f69", // faint slate
    none: "transparent",
};

export const PRIORITY_OPTIONS = [
    { value: "urgent", label: "Urgent", color: PRIORITY_COLORS.urgent },
    { value: "high", label: "High", color: PRIORITY_COLORS.high },
    { value: "medium", label: "Medium", color: PRIORITY_COLORS.medium },
    { value: "low", label: "Low", color: PRIORITY_COLORS.low },
    { value: "none", label: "None", color: "#565f69" },
] as const;
