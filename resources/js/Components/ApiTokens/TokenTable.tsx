import DeleteIcon from "@mui/icons-material/Delete";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { PersonalAccessToken } from "@/types";

interface TokenTableProps {
    tokens: PersonalAccessToken[];
    onRevoke: (token: PersonalAccessToken) => void;
}

export default function TokenTable({ tokens, onRevoke }: TokenTableProps) {
    if (tokens.length === 0) {
        return null;
    }

    return (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Abilities</TableCell>
                        <TableCell>Last Used</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {tokens.map((token) => (
                        <TableRow key={token.id}>
                            <TableCell>
                                <Typography variant="body2" fontWeight={500}>
                                    {token.name}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                {token.abilities.map((ability) => (
                                    <Chip
                                        key={ability}
                                        label={ability}
                                        size="small"
                                        variant="outlined"
                                        sx={{ mr: 0.5 }}
                                    />
                                ))}
                            </TableCell>
                            <TableCell>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {token.last_used_at
                                        ? new Date(
                                              token.last_used_at,
                                          ).toLocaleDateString()
                                        : "Never"}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {new Date(
                                        token.created_at,
                                    ).toLocaleDateString()}
                                </Typography>
                            </TableCell>
                            <TableCell align="right">
                                <Tooltip title="Revoke">
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => onRevoke(token)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
