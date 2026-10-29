<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabConnection;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteGitlabConnection
{
    use AsAction;

    public function handle(GitlabConnection $connection): void
    {
        // Unlink each project first: best-effort webhook cleanup, and removal
        // of task refs that could never be updated again.
        foreach ($connection->projects as $project) {
            UnlinkGitlabProject::run($project->setRelation('connection', $connection));
        }

        $connection->delete();
    }
}
