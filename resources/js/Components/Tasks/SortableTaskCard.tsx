import TaskCard from "@/Components/Tasks/TaskCard";
import type { Task } from "@/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, type KeyboardEvent } from "react";

interface Props {
    task: Task;
    onClick?: (task: Task) => void;
}

const SortableTaskCard = memo(function SortableTaskCard({
    task,
    onClick,
}: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        listeners?.onKeyDown?.(event);
        if (!event.defaultPrevented && event.key === "Enter") {
            event.preventDefault();
            onClick?.(task);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onClick?.(task)}
            onKeyDown={handleKeyDown}
            aria-roledescription="sortable item"
        >
            <TaskCard task={task} interactive={false} />
        </div>
    );
});

export default SortableTaskCard;
