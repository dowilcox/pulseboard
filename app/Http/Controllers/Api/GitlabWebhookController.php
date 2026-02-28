<?php

namespace App\Http\Controllers\Api;

use App\Actions\Gitlab\HandleMergeRequestWebhook;
use App\Actions\Gitlab\HandlePipelineWebhook;
use App\Http\Controllers\Controller;
use App\Models\GitlabConnection;
use App\Models\GitlabProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class GitlabWebhookController extends Controller
{
    public function handle(GitlabConnection $connection, Request $request): JsonResponse
    {
        $event = $request->header('X-Gitlab-Event');
        $payload = $request->all();

        $gitlabProjectId = $payload['project']['id'] ?? null;

        if (! $gitlabProjectId) {
            return response()->json(['message' => 'No project ID in payload'], 400);
        }

        $gitlabProject = GitlabProject::where('gitlab_connection_id', $connection->id)
            ->where('gitlab_project_id', $gitlabProjectId)
            ->first();

        if (! $gitlabProject) {
            Log::info("GitLab webhook received for unlinked project {$gitlabProjectId}");

            return response()->json(['message' => 'Project not linked'], 200);
        }

        match ($event) {
            'Merge Request Hook' => HandleMergeRequestWebhook::run($gitlabProject, $payload),
            'Pipeline Hook' => HandlePipelineWebhook::run($gitlabProject, $payload),
            'Push Hook' => $this->handlePush($gitlabProject, $payload),
            default => Log::info("Unhandled GitLab webhook event: {$event}"),
        };

        return response()->json(['message' => 'OK']);
    }

    protected function handlePush(GitlabProject $gitlabProject, array $payload): void
    {
        // Push events can be used for auto-linking branches
        $ref = $payload['ref'] ?? '';
        $branchName = str_replace('refs/heads/', '', $ref);

        if (! $branchName) {
            return;
        }

        // Auto-link based on branch name pattern
        \App\Actions\Gitlab\AutoLinkTask::run(
            gitlabProject: $gitlabProject,
            text: $branchName,
            linkType: 'branch',
            gitlabRef: $branchName,
            title: $branchName,
            url: $gitlabProject->web_url.'/-/tree/'.$branchName,
        );
    }
}
