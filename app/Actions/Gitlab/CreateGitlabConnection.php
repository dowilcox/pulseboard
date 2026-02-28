<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabConnection;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateGitlabConnection
{
    use AsAction;

    public function handle(array $data): GitlabConnection
    {
        return GitlabConnection::create([
            'name' => $data['name'],
            'base_url' => rtrim($data['base_url'], '/'),
            'api_token' => $data['api_token'],
            'webhook_secret' => Str::random(32),
            'is_active' => $data['is_active'] ?? true,
        ]);
    }
}
