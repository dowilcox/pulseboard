import TaskCard from "@/Components/Tasks/TaskCard";
import type { Task } from "@/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";

interface Props {
    task: Task;
    onClick?: (task: Task) => void;
}

function getVisibleTaskLabel(task: Task): string {
    return [task.task_number ? `#${task.task_number}` : null, task.title]
        .filter(Boolean)
        .join(" ");
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

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            aria-roledescription="sortable item"
            aria-label={`Draggable task: ${getVisibleTaskLabel(task)}`}
        >
            <TaskCard task={task} onClick={onClick} />
        </div>
    );
});

export default SortableTaskCard;
