import TaskCard from "@/Components/Tasks/TaskCard";
import type { Task } from "@/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, type MouseEvent } from "react";

interface Props {
    task: Task;
    href: string;
    /**
     * True while a drag is in progress or has just ended. The click that
     * follows a pointer drag must not follow the card's link.
     */
    isClickSuppressed: () => boolean;
    /** The board's keyboard cursor is on this card. */
    keyboardFocused?: boolean;
    /** Roving tab stop from keyboard navigation (0 or -1). */
    tabIndex?: number;
}

const SortableTaskCard = memo(function SortableTaskCard({
    task,
    href,
    isClickSuppressed,
    keyboardFocused = false,
    tabIndex,
}: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const handleClickCapture = (event: MouseEvent) => {
        if (isClickSuppressed()) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    // The card is a link: keep its native role and focusability, and only
    // borrow dnd-kit's keyboard instructions (Space picks the card up; Enter
    // follows the link).
    return (
        <div ref={setNodeRef} style={style}>
            <TaskCard
                ref={setActivatorNodeRef}
                task={task}
                href={href}
                {...listeners}
                aria-describedby={attributes["aria-describedby"]}
                onClickCapture={handleClickCapture}
                data-task-id={task.id}
                keyboardFocused={keyboardFocused}
                tabIndex={tabIndex}
            />
        </div>
    );
});

export default SortableTaskCard;
