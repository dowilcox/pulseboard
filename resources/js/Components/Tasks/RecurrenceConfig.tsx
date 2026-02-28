import type { RecurrenceConfig as RecurrenceConfigType } from '@/types';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

interface Props {
    config: RecurrenceConfigType | null | undefined;
    onChange: (config: RecurrenceConfigType | null) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RecurrenceConfig({ config, onChange }: Props) {
    const enabled = config !== null && config !== undefined;

    const handleToggle = () => {
        if (enabled) {
            onChange(null);
        } else {
            onChange({ frequency: 'weekly', interval: 1 });
        }
    };

    const handleFrequencyChange = (frequency: RecurrenceConfigType['frequency']) => {
        if (!config) return;
        const updated: RecurrenceConfigType = { ...config, frequency, interval: config.interval || 1 };
        if (frequency !== 'weekly') {
            delete updated.days_of_week;
        }
        if (frequency !== 'monthly') {
            delete updated.day_of_month;
        }
        onChange(updated);
    };

    const handleIntervalChange = (interval: number) => {
        if (!config) return;
        onChange({ ...config, interval: Math.max(1, interval) });
    };

    const handleDaysOfWeekChange = (_: unknown, newDays: number[]) => {
        if (!config) return;
        onChange({ ...config, days_of_week: newDays.length > 0 ? newDays : undefined });
    };

    const handleDayOfMonthChange = (day: number) => {
        if (!config) return;
        onChange({ ...config, day_of_month: day > 0 && day <= 31 ? day : undefined });
    };

    const handleEndDateChange = (endDate: string) => {
        if (!config) return;
        onChange({ ...config, end_date: endDate || undefined });
    };

    const frequencyLabel = () => {
        if (!config) return '';
        switch (config.frequency) {
            case 'daily':
                return config.interval === 1 ? 'day' : `${config.interval} days`;
            case 'weekly':
                return config.interval === 1 ? 'week' : `${config.interval} weeks`;
            case 'monthly':
                return config.interval === 1 ? 'month' : `${config.interval} months`;
            default:
                return `${config.interval} days`;
        }
    };

    return (
        <Box>
            <FormControlLabel
                control={<Switch checked={enabled} onChange={handleToggle} size="small" />}
                label={
                    <Typography variant="body2">
                        {enabled ? `Repeats every ${frequencyLabel()}` : 'Recurring task'}
                    </Typography>
                }
            />

            {enabled && config && (
                <Box sx={{ mt: 1.5, pl: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {/* Frequency */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                            Every
                        </Typography>
                        <TextField
                            type="number"
                            size="small"
                            value={config.interval}
                            onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
                            slotProps={{ htmlInput: { min: 1, max: 365 } }}
                            sx={{ width: 70 }}
                        />
                        <Select
                            size="small"
                            value={config.frequency}
                            onChange={(e) =>
                                handleFrequencyChange(e.target.value as RecurrenceConfigType['frequency'])
                            }
                            sx={{ minWidth: 100 }}
                        >
                            <MenuItem value="daily">Day(s)</MenuItem>
                            <MenuItem value="weekly">Week(s)</MenuItem>
                            <MenuItem value="monthly">Month(s)</MenuItem>
                            <MenuItem value="custom">Custom</MenuItem>
                        </Select>
                    </Box>

                    {/* Days of week (for weekly) */}
                    {config.frequency === 'weekly' && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                On days
                            </Typography>
                            <ToggleButtonGroup
                                value={config.days_of_week ?? []}
                                onChange={handleDaysOfWeekChange}
                                size="small"
                                aria-label="Days of week"
                            >
                                {DAY_LABELS.map((label, index) => (
                                    <ToggleButton
                                        key={index}
                                        value={index}
                                        sx={{ px: 1, py: 0.5, fontSize: '0.7rem' }}
                                    >
                                        {label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Box>
                    )}

                    {/* Day of month (for monthly) */}
                    {config.frequency === 'monthly' && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                                On day
                            </Typography>
                            <TextField
                                type="number"
                                size="small"
                                value={config.day_of_month ?? ''}
                                onChange={(e) => handleDayOfMonthChange(parseInt(e.target.value) || 0)}
                                placeholder="1-31"
                                slotProps={{ htmlInput: { min: 1, max: 31 } }}
                                sx={{ width: 70 }}
                            />
                        </Box>
                    )}

                    {/* End date */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                            Until
                        </Typography>
                        <TextField
                            type="date"
                            size="small"
                            value={config.end_date ?? ''}
                            onChange={(e) => handleEndDateChange(e.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }}
                            placeholder="No end date"
                            sx={{ flex: 1 }}
                        />
                    </Box>
                </Box>
            )}
        </Box>
    );
}
