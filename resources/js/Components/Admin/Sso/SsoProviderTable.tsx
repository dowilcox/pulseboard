import type { SsoConfiguration } from "@/types";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import SyncIcon from "@mui/icons-material/Sync";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { PROVIDER_LABELS } from "./ssoForm";

export interface SsoTestCheck {
    label: string;
    ok: boolean;
    detail: string;
}

export interface SsoTestResult {
    success: boolean;
    message: string;
    checks?: SsoTestCheck[];
}

interface SsoProviderTableProps {
    configurations: SsoConfiguration[];
    testResults: Record<string, SsoTestResult>;
    testingIds: Set<string>;
    onTest: (config: SsoConfiguration) => void;
    onEdit: (config: SsoConfiguration) => void;
    onDelete: (config: SsoConfiguration) => void;
}

function endpointOf(config: SsoConfiguration): string {
    return config.provider === "oidc" ? config.issuer : config.entity_id;
}

function TestResultChip({ result }: { result: SsoTestResult }) {
    const chip = (
        <Chip
            icon={result.success ? <CheckCircleIcon /> : <ErrorIcon />}
            label={result.message}
            color={result.success ? "success" : "error"}
            size="small"
            variant="outlined"
            sx={{ maxWidth: 360 }}
        />
    );

    if (!result.checks?.length) return chip;

    return (
        <Tooltip
            title={
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {result.checks.map((check) => (
                        <li key={check.label}>
                            {check.ok ? "✓" : "✗"} {check.label}: {check.detail}
                        </li>
                    ))}
                </Box>
            }
        >
            {chip}
        </Tooltip>
    );
}

export default function SsoProviderTable({
    configurations,
    testResults,
    testingIds,
    onTest,
    onEdit,
    onDelete,
}: SsoProviderTableProps) {
    return (
        <TableContainer component={Paper} variant="outlined">
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Issuer / Entity ID</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Test</TableCell>
                        <TableCell align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {configurations.map((config) => {
                        const testing = testingIds.has(config.id);
                        const result = testResults[config.id];

                        return (
                            <TableRow key={config.id}>
                                <TableCell>
                                    <Typography fontWeight={500}>
                                        {config.name}
                                    </Typography>
                                    {config.button_label && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            display="block"
                                        >
                                            Sign in with {config.button_label}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={PROVIDER_LABELS[config.provider]}
                                        size="small"
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        noWrap
                                        sx={{ maxWidth: 300 }}
                                        title={endpointOf(config)}
                                    >
                                        {endpointOf(config)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={
                                            config.is_active
                                                ? "Active"
                                                : "Inactive"
                                        }
                                        color={
                                            config.is_active
                                                ? "success"
                                                : "default"
                                        }
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <Tooltip
                                            title={
                                                config.provider === "oidc"
                                                    ? "Test connection (fetch discovery and signing keys)"
                                                    : "Test configuration"
                                            }
                                        >
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        onTest(config)
                                                    }
                                                    disabled={testing}
                                                    aria-label={`Test ${config.name}`}
                                                >
                                                    {testing ? (
                                                        <CircularProgress
                                                            size={18}
                                                        />
                                                    ) : (
                                                        <SyncIcon fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        {result && (
                                            <TestResultChip result={result} />
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Edit">
                                        <IconButton
                                            size="small"
                                            onClick={() => onEdit(config)}
                                            aria-label={`Edit ${config.name}`}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => onDelete(config)}
                                            aria-label={`Delete ${config.name}`}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
