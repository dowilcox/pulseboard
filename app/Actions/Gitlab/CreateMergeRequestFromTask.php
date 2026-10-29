<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabRef;
use App\Services\ActivityLogger;
use App\Services\GitlabApiService;
use App\Support\RichTextMarkdown;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateMergeRequestFromTask
{
    use AsAction;

    /** Characters of the task description copied into the MR. */
    private const DESCRIPTION_LIMIT = 500;

    public function handle(Task $task, GitlabProject $gitlabProject, ?string $sourceBranch = null): TaskGitlabRef
    {
        $existingMr = $task->gitlabRefs()
            ->where('ref_type', 'merge_request')
            ->whereIn('state', ['opened', 'locked'])
            ->first();
        if ($existingMr) {
            throw ValidationException::withMessages([
                'merge_request' => ['An open merge request already exists for this task.'],
            ]);
        }

        $api = GitlabApiService::for($gitlabProject->connection);

        // Use provided branch or find existing branch ref for this task
        if (! $sourceBranch) {
            $branchRef = $task->gitlabRefs()
                ->where('ref_type', 'branch')
                ->first();

            if ($branchRef) {
                $sourceBranch = $branchRef->gitlab_ref;
            } else {
                // Create a branch first
                $newBranchRef = CreateBranchFromTask::run($task, $gitlabProject);
                $sourceBranch = $newBranchRef->gitlab_ref;
            }
        }

        $mrData = $api->createMergeRequest($gitlabProject->gitlab_project_id, [
            'source_branch' => $sourceBranch,
            'target_branch' => $gitlabProject->default_branch,
            'title' => "#{$task->task_number}: {$task->title}",
            'description' => $this->description($task),
        ]);

        $ref = TaskGitlabRef::create([
            'task_id' => $task->id,
            'ref_type' => 'merge_request',
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

        return $ref;
    }

    /**
     * A link back to the task, followed by the start of its description as
     * clean Markdown (mentions as @Name, no editor HTML, cut on a word or
     * line boundary).
     */
    private function description(Task $task): string
    {
        $task->loadMissing('board.team');

        $url = route('tasks.show', [$task->board->team->slug, $task->board->slug, $task->getRouteKey()]);
        $title = str_replace(['[', ']'], ['\\[', '\\]'], $task->title);
        $description = "Task: [#{$task->task_number} {$title}]({$url})";

        $excerpt = RichTextMarkdown::excerpt($task->description, self::DESCRIPTION_LIMIT);

        if ($excerpt !== null) {
            $description .= "\n\n".$excerpt;
        }

        return $description;
    }
}
