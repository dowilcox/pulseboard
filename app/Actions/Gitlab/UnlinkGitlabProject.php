<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabRef;
use Illuminate\Support\Facades\DB;
use Lorisleiva\Actions\Concerns\AsAction;

class UnlinkGitlabProject
{
    use AsAction;

    /**
     * Unlink a GitLab project from its team.
     *
     * Webhook events and the background sync find a task's branches and
     * merge requests through the task's GitLab project, so once the project
     * is gone its refs can never update again. They are deleted along with
     * the link (tasks.gitlab_project_id is cleared by its nullOnDelete FK).
     */
    public function handle(GitlabProject $gitlabProject): void
    {
        // Best-effort webhook removal
        RemoveProjectWebhook::run($gitlabProject);

        DB::transaction(function () use ($gitlabProject) {
            TaskGitlabRef::whereIn(
                'task_id',
                Task::where('gitlab_project_id', $gitlabProject->id)->select('id'),
            )->delete();

            $gitlabProject->delete();
        });
    }
}
