<?php

namespace App\Actions\Figma;

use App\Models\FigmaConnection;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateFigmaConnection
{
    use AsAction;

    public function handle(
        FigmaConnection $connection,
        array $data,
    ): FigmaConnection {
        $updates = [
            "name" => $data["name"] ?? $connection->name,
            "is_active" => $data["is_active"] ?? $connection->is_active,
        ];

        // Only update token if provided (partial update pattern)
        if (!empty($data["api_token"])) {
            $updates["api_token"] = $data["api_token"];
        }

        $connection->update($updates);

        return $connection->fresh();
    }
}
