import { Link as InertiaLink } from '@inertiajs/react';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import type { ReactNode } from 'react';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface PageHeaderProps {
    /** The current page title displayed as h2 */
    title: string;
    /** Breadcrumb trail (excluding "Home" which is always first, and current page which uses title) */
    breadcrumbs?: BreadcrumbItem[];
    /** Optional actions (buttons, etc.) rendered on the right side */
    actions?: ReactNode;
}

export default function PageHeader({ title, breadcrumbs = [], actions }: PageHeaderProps) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Box sx={{ minWidth: 0 }}>
                <MuiBreadcrumbs
                    separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
                    sx={{ mb: 0.25 }}
                    aria-label="breadcrumb"
                >
                    <Link
                        component={InertiaLink}
                        href={route('dashboard')}
                        underline="hover"
                        color="text.secondary"
                        variant="body2"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                        <HomeIcon sx={{ fontSize: 14 }} />
                        Home
                    </Link>
                    {breadcrumbs.map((crumb) =>
                        crumb.href ? (
                            <Link
                                key={crumb.label}
                                component={InertiaLink}
                                href={crumb.href}
                                underline="hover"
                                color="text.secondary"
                                variant="body2"
                            >
                                {crumb.label}
                            </Link>
                        ) : (
                            <Typography key={crumb.label} variant="body2" color="text.secondary">
                                {crumb.label}
                            </Typography>
                        ),
                    )}
                    <Typography variant="body2" color="text.primary" fontWeight={500}>
                        {title}
                    </Typography>
                </MuiBreadcrumbs>
                <Typography variant="h6" component="h2" fontWeight={600} noWrap>
                    {title}
                </Typography>
            </Box>
            {actions && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, flexShrink: 0 }}>
                    {actions}
                </Box>
            )}
        </Box>
    );
}
