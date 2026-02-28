<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabLink;
use App\Services\ActivityLogger;
use App\Services\GitlabApiService;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateBranchFromTask
{
    use AsAction;

    public function handle(Task $task, GitlabProject $gitlabProject): TaskGitlabLink
    {
        $branchName = $this->generateBranchName($task);
        $api = GitlabApiService::for($gitlabProject->connection);

        $branch = $api->createBranch(
            $gitlabProject->gitlab_project_id,
            $branchName,
            $gitlabProject->default_branch,
        );

        $link = TaskGitlabLink::create([
            'task_id' => $task->id,
            'gitlab_project_id' => $gitlabProject->id,
            'link_type' => 'branch',
            'gitlab_ref' => $branchName,
            'title' => $branchName,
            'url' => $gitlabProject->web_url.'/-/tree/'.$branchName,
            'last_synced_at' => now(),
        ]);

        ActivityLogger::log($task, 'gitlab_branch_created', [
            'branch' => $branchName,
            'project' => $gitlabProject->path_with_namespace,
        ], auth()->user());

        return $link;
    }

    protected function generateBranchName(Task $task): string
    {
        $slug = Str::slug($task->title);

        // pb-{taskNumber}-{title-slug}, max 100 chars
        $prefix = "pb-{$task->task_number}-";
        $maxSlugLength = 100 - strlen($prefix);
        $slug = Str::limit($slug, $maxSlugLength, '');

        return $prefix.$slug;
    }
}
