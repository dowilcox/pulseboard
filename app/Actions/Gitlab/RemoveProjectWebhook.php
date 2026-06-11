<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Services\GitlabApiService;
use Illuminate\Support\Facades\Log;
use Lorisleiva\Actions\Concerns\AsAction;

class RemoveProjectWebhook
{
    use AsAction;

    /**
     * Best-effort removal of the GitLab webhook registered for a linked project.
     * Failures are logged and swallowed so cleanup flows can proceed.
     */
    public function handle(GitlabProject $project): void
    {
        if (! $project->webhook_id) {
            return;
        }

        try {
            GitlabApiService::for($project->connection)->deleteWebhook(
                $project->gitlab_project_id,
                $project->webhook_id,
            );
        } catch (\Exception $e) {
            Log::warning("Failed to remove webhook for project {$project->path_with_namespace}: {$e->getMessage()}");
        }
    }
}
