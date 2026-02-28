<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabConnection;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateGitlabConnection
{
    use AsAction;

    public function handle(GitlabConnection $connection, array $data): GitlabConnection
    {
        $updates = [
            'name' => $data['name'] ?? $connection->name,
            'base_url' => isset($data['base_url']) ? rtrim($data['base_url'], '/') : $connection->base_url,
            'is_active' => $data['is_active'] ?? $connection->is_active,
        ];

        // Only update token if provided (partial update pattern)
        if (! empty($data['api_token'])) {
            $updates['api_token'] = $data['api_token'];
        }

        $connection->update($updates);

        return $connection->fresh();
    }
}
