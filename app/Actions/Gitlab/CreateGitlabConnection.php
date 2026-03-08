<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabConnection;
use App\Models\Team;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateGitlabConnection
{
    use AsAction;

    public function handle(Team $team, array $data): GitlabConnection
    {
        return GitlabConnection::create([
            'team_id' => $team->id,
            'name' => $data['name'],
            'base_url' => rtrim($data['base_url'], '/'),
            'api_token' => $data['api_token'],
            'webhook_secret' => Str::random(32),
            'is_active' => $data['is_active'] ?? true,
        ]);
    }
}
