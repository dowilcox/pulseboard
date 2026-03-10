<?php

namespace App\Actions\Figma;

use App\Models\FigmaConnection;
use App\Models\Team;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateFigmaConnection
{
    use AsAction;

    public function handle(Team $team, array $data): FigmaConnection
    {
        return FigmaConnection::create([
            "team_id" => $team->id,
            "name" => $data["name"],
            "api_token" => $data["api_token"],
            "is_active" => $data["is_active"] ?? true,
        ]);
    }
}
