import CustomFieldValue from "@/Components/CustomFields/CustomFieldValue";
import type { BoardCustomField, Task } from "@/types";
import { cardFields, getFieldValue, hasValue } from "@/utils/customFields";
import Box from "@mui/material/Box";

interface Props {
    fields: BoardCustomField[];
    task: Pick<Task, "custom_fields">;
}

/** The "show on card" custom field values of a task, as a row of pills. */
export default function TaskCardCustomFields({ fields, task }: Props) {
    const shown = cardFields(fields).filter((field) =>
        hasValue(getFieldValue(task, field.id)),
    );
    if (shown.length === 0) return null;

    return (
        <Box
            sx={{
                display: "flex",
                gap: "6px",
                flexWrap: "wrap",
                minWidth: 0,
            }}
        >
            {shown.map((field) => (
                <CustomFieldValue
                    key={field.id}
                    field={field}
                    value={getFieldValue(task, field.id)}
                />
            ))}
        </Box>
    );
}
