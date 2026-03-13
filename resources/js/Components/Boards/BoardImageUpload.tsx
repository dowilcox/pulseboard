import type { Board } from "@/types";
import ImageUpload from "@/Components/Common/ImageUpload";

interface Props {
    board: Board;
    teamId: string;
}

export default function BoardImageUpload({ board, teamId }: Props) {
    return (
        <ImageUpload
            title="Board Image"
            description="Upload an image to use as the board avatar in the sidebar. Recommended size: 128×128px. Max file size: 2MB."
            imageUrl={board.image_url}
            altText={board.name}
            uploadRoute={route("teams.boards.upload-image", [teamId, board.id])}
            deleteRoute={route("teams.boards.delete-image", [teamId, board.id])}
        />
    );
}
