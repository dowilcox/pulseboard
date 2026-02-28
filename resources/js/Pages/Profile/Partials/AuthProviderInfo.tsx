import { usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

const providerLabels: Record<string, string> = {
    local: 'Local',
    saml2: 'SAML2',
    okta: 'Okta',
};

export default function AuthProviderInfo() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    return (
        <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Account Information
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Your account details and authentication method.
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Avatar
                    src={user.avatar_url}
                    alt={user.name}
                    sx={{ width: 64, height: 64, fontSize: '1.5rem' }}
                >
                    {user.name.charAt(0).toUpperCase()}
                </Avatar>

                <Box>
                    <Typography variant="h6">{user.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {user.email}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                        <Chip
                            label={`Authenticated via: ${providerLabels[user.auth_provider] ?? user.auth_provider}`}
                            size="small"
                            variant="outlined"
                        />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
