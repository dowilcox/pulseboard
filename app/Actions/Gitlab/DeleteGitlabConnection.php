<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabConnection;
use App\Services\GitlabApiService;
use Illuminate\Support\Facades\Log;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteGitlabConnection
{
    use AsAction;

    public function handle(GitlabConnection $connection): void
    {
        // Best-effort webhook cleanup on linked projects
        $api = GitlabApiService::for($connection);

        foreach ($connection->projects as $project) {
            if ($project->webhook_id) {
                try {
                    $api->deleteWebhook($project->gitlab_project_id, $project->webhook_id);
                } catch (\Exception $e) {
                    Log::warning("Failed to remove webhook for project {$project->path_with_namespace}: {$e->getMessage()}");
                }
            }
        }

        $connection->delete();
    }
}
