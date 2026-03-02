import { LABEL_COLORS } from '@/constants/labelColors';
import Box from '@mui/material/Box';

interface ColorSwatchPickerProps {
    value: string;
    onChange: (color: string) => void;
    colors?: readonly string[];
}

export default function ColorSwatchPicker({
    value,
    onChange,
    colors = LABEL_COLORS,
}: ColorSwatchPickerProps) {
    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {colors.map((color) => (
                <Box
                    key={color}
                    component="button"
                    type="button"
                    onClick={() => onChange(color)}
                    aria-label={`Select color ${color}`}
                    aria-pressed={value.toLowerCase() === color.toLowerCase()}
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: color,
                        border: 'none',
                        cursor: 'pointer',
                        p: 0,
                        outline: value.toLowerCase() === color.toLowerCase()
                            ? '2px solid'
                            : '2px solid transparent',
                        outlineColor: value.toLowerCase() === color.toLowerCase()
                            ? 'primary.main'
                            : 'transparent',
                        outlineOffset: 2,
                        transition: 'outline-color 0.15s',
                        '&:hover': {
                            outlineColor: 'text.secondary',
                        },
                        '&:focus-visible': {
                            outlineColor: 'primary.main',
                        },
                    }}
                />
            ))}
        </Box>
    );
}
