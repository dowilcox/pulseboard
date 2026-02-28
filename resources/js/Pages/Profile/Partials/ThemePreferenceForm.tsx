import { useForm, usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';

export default function ThemePreferenceForm() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const { data, setData, patch, processing } = useForm({
        name: user.name,
        email: user.email,
        theme_preference: user.theme_preference ?? 'system',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('profile.update'));
    };

    return (
        <Box component="form" onSubmit={handleSubmit}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Theme Preference
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Choose your preferred color scheme.
            </Typography>

            <FormControl>
                <RadioGroup
                    value={data.theme_preference}
                    onChange={(e) => setData('theme_preference', e.target.value as 'light' | 'dark' | 'system')}
                >
                    <FormControlLabel value="light" control={<Radio />} label="Light" />
                    <FormControlLabel value="dark" control={<Radio />} label="Dark" />
                    <FormControlLabel value="system" control={<Radio />} label="System" />
                </RadioGroup>
            </FormControl>

            <Box sx={{ mt: 2 }}>
                <Button type="submit" variant="contained" disabled={processing}>
                    Save Preference
                </Button>
            </Box>
        </Box>
    );
}
