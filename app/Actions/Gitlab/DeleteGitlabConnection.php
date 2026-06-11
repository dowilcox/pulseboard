<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabConnection;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteGitlabConnection
{
    use AsAction;

    public function handle(GitlabConnection $connection): void
    {
        // Best-effort webhook cleanup on linked projects
        foreach ($connection->projects as $project) {
            RemoveProjectWebhook::run($project->setRelation('connection', $connection));
        }

        $connection->delete();
    }
}
