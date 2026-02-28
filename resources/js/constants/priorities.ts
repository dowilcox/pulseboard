export const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#6366f1',   // primary instead of blue
    low: '#94a3b8',      // warmer slate
    none: 'transparent',
};

export const PRIORITY_OPTIONS = [
    { value: 'urgent', label: 'Urgent', color: PRIORITY_COLORS.urgent },
    { value: 'high',   label: 'High',   color: PRIORITY_COLORS.high },
    { value: 'medium', label: 'Medium', color: PRIORITY_COLORS.medium },
    { value: 'low',    label: 'Low',    color: PRIORITY_COLORS.low },
    { value: 'none',   label: 'None',   color: '#d1d5db' },
] as const;
