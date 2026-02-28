import { Component, type ErrorInfo, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '50vh',
                        p: 4,
                    }}
                >
                    <Alert severity="error" sx={{ mb: 3, maxWidth: 500 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            Something went wrong
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            An unexpected error occurred. Please try again.
                        </Typography>
                    </Alert>
                    <Button variant="contained" onClick={this.handleRetry}>
                        Try Again
                    </Button>
                </Box>
            );
        }

        return this.props.children;
    }
}
