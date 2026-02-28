<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabConnection;
use App\Models\GitlabProject;
use App\Models\Team;
use App\Services\GitlabApiService;
use Lorisleiva\Actions\Concerns\AsAction;

class LinkGitlabProject
{
    use AsAction;

    public function handle(Team $team, GitlabConnection $connection, int $gitlabProjectId): GitlabProject
    {
        $api = GitlabApiService::for($connection);

        // Fetch project info from GitLab
        $projectData = $api->getProject($gitlabProjectId);

        // Register webhook on GitLab
        $webhookUrl = url(config('gitlab.webhook_prefix').'/'.$connection->id);
        $webhook = $api->registerWebhook(
            $gitlabProjectId,
            $webhookUrl,
            $connection->webhook_secret,
        );

        return GitlabProject::create([
            'gitlab_connection_id' => $connection->id,
            'team_id' => $team->id,
            'gitlab_project_id' => $gitlabProjectId,
            'name' => $projectData['name'],
            'path_with_namespace' => $projectData['path_with_namespace'],
            'default_branch' => $projectData['default_branch'] ?? 'main',
            'web_url' => $projectData['web_url'],
            'webhook_id' => $webhook['id'] ?? null,
        ]);
    }
}
