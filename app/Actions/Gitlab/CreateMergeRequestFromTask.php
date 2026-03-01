<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabLink;
use App\Services\ActivityLogger;
use App\Services\GitlabApiService;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateMergeRequestFromTask
{
    use AsAction;

    public function handle(Task $task, GitlabProject $gitlabProject, ?string $sourceBranch = null): TaskGitlabLink
    {
        $api = GitlabApiService::for($gitlabProject->connection);

        // Use provided branch or find existing branch link for this task
        if (! $sourceBranch) {
            $branchLink = $task->gitlabLinks()
                ->where('gitlab_project_id', $gitlabProject->id)
                ->where('link_type', 'branch')
                ->first();

            if ($branchLink) {
                $sourceBranch = $branchLink->gitlab_ref;
            } else {
                // Create a branch first
                $newBranchLink = CreateBranchFromTask::run($task, $gitlabProject);
                $sourceBranch = $newBranchLink->gitlab_ref;
            }
        }

        $description = "Task: #{$task->task_number}";
        if ($task->description) {
            $description .= "\n\n".mb_substr($task->description, 0, 500);
        }

        $mrData = $api->createMergeRequest($gitlabProject->gitlab_project_id, [
            'source_branch' => $sourceBranch,
            'target_branch' => $gitlabProject->default_branch,
            'title' => "#{$task->task_number}: {$task->title}",
            'description' => $description,
        ]);

        $link = TaskGitlabLink::create([
            'task_id' => $task->id,
            'gitlab_project_id' => $gitlabProject->id,
            'link_type' => 'merge_request',
            'gitlab_iid' => $mrData['iid'],
            'gitlab_ref' => $sourceBranch,
            'title' => $mrData['title'],
            'state' => $mrData['state'],
            'url' => $mrData['web_url'],
            'author' => $mrData['author']['name'] ?? null,
            'meta' => [
                'approvals' => 0,
                'source_branch' => $sourceBranch,
                'target_branch' => $gitlabProject->default_branch,
            ],
            'last_synced_at' => now(),
        ]);

        ActivityLogger::log($task, 'gitlab_mr_created', [
            'mr_iid' => $mrData['iid'],
            'mr_title' => $mrData['title'],
            'project' => $gitlabProject->path_with_namespace,
        ], auth()->user());

        return $link;
    }
}
