import type { User } from "@/types";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export interface MentionListProps {
    items: User[];
    command: (attrs: { id: string; label: string }) => void;
}

export interface MentionListRef {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
    ({ items, command }, ref) => {
        const [selectedIndex, setSelectedIndex] = useState(0);

        useEffect(() => {
            setSelectedIndex(0);
        }, [items]);

        useImperativeHandle(ref, () => ({
            onKeyDown: ({ event }) => {
                if (event.key === "ArrowUp") {
                    setSelectedIndex(
                        (prev) => (prev + items.length - 1) % items.length,
                    );
                    return true;
                }
                if (event.key === "ArrowDown") {
                    setSelectedIndex((prev) => (prev + 1) % items.length);
                    return true;
                }
                if (event.key === "Enter") {
                    const item = items[selectedIndex];
                    if (item) {
                        command({ id: item.id, label: item.name });
                    }
                    return true;
                }
                return false;
            },
        }));

        if (!items.length) {
            return (
                <Box
                    sx={{
                        bgcolor: "background.paper",
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        boxShadow: 3,
                        p: 1.5,
                    }}
                >
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        fontSize="0.8rem"
                    >
                        No users found
                    </Typography>
                </Box>
            );
        }

        return (
            <Box
                sx={{
                    bgcolor: "background.paper",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    boxShadow: 3,
                    py: 0.5,
                    maxHeight: 240,
                    overflowY: "auto",
                    minWidth: 200,
                }}
            >
                {items.map((item, index) => (
                    <Box
                        key={item.id}
                        onClick={() =>
                            command({ id: item.id, label: item.name })
                        }
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 1.5,
                            py: 0.75,
                            cursor: "pointer",
                            bgcolor:
                                index === selectedIndex
                                    ? "action.selected"
                                    : "transparent",
                            "&:hover": { bgcolor: "action.hover" },
                        }}
                    >
                        <Avatar
                            src={item.avatar_url}
                            sx={{ width: 24, height: 24, fontSize: "0.7rem" }}
                        >
                            {item.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" fontSize="0.85rem">
                            {item.name}
                        </Typography>
                    </Box>
                ))}
            </Box>
        );
    },
);

MentionList.displayName = "MentionList";

export default MentionList;
