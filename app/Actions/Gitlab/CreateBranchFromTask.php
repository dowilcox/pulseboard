<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabRef;
use App\Services\ActivityLogger;
use App\Services\GitlabApiService;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateBranchFromTask
{
    use AsAction;

    public function handle(Task $task, GitlabProject $gitlabProject): TaskGitlabRef
    {
        $branchName = $this->generateBranchName($task);
        $api = GitlabApiService::for($gitlabProject->connection);

        $branch = $api->createBranch(
            $gitlabProject->gitlab_project_id,
            $branchName,
            $gitlabProject->default_branch,
        );

        $ref = TaskGitlabRef::create([
            'task_id' => $task->id,
            'ref_type' => 'branch',
            'gitlab_ref' => $branchName,
            'title' => $branchName,
            'url' => $gitlabProject->web_url.'/-/tree/'.$branchName,
            'last_synced_at' => now(),
        ]);

        ActivityLogger::log($task, 'gitlab_branch_created', [
            'branch' => $branchName,
            'project' => $gitlabProject->path_with_namespace,
        ], auth()->user());

        return $ref;
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
