<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Services\GitlabApiService;
use Illuminate\Support\Facades\Log;
use Lorisleiva\Actions\Concerns\AsAction;

class UnlinkGitlabProject
{
    use AsAction;

    public function handle(GitlabProject $gitlabProject): void
    {
        // Best-effort webhook removal
        if ($gitlabProject->webhook_id) {
            try {
                $api = GitlabApiService::for($gitlabProject->connection);
                $api->deleteWebhook($gitlabProject->gitlab_project_id, $gitlabProject->webhook_id);
            } catch (\Exception $e) {
                Log::warning("Failed to remove webhook for project {$gitlabProject->path_with_namespace}: {$e->getMessage()}");
            }
        }

        $gitlabProject->delete();
    }
}
