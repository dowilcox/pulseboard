<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabRef;
use Lorisleiva\Actions\Concerns\AsAction;

class AutoLinkTask
{
    use AsAction;

    /**
     * Parse text for #{number} patterns and auto-link matching tasks.
     *
     * @return TaskGitlabRef[] Created refs
     */
    public function handle(
        GitlabProject $gitlabProject,
        string $text,
        string $refType,
        ?int $gitlabIid = null,
        ?string $gitlabRef = null,
        ?string $title = null,
        ?string $state = null,
        ?string $url = null,
        ?string $author = null,
        ?string $pipelineStatus = null,
        array $meta = [],
    ): array {
        $pattern = config('gitlab.auto_link_pattern');
        $refs = [];

        if (! preg_match_all($pattern, $text, $matches)) {
            return $refs;
        }

        $taskNumbers = array_unique($matches[1]);

        // Get all boards belonging to this project's team
        $boardIds = $gitlabProject->team->boards()->pluck('id');

        foreach ($taskNumbers as $taskNumber) {
            $task = Task::whereIn('board_id', $boardIds)
                ->where('task_number', (int) $taskNumber)
                ->first();

            if (! $task) {
                continue;
            }

            // Auto-set the task's gitlab project if not already set
            if (! $task->gitlab_project_id) {
                $task->update(['gitlab_project_id' => $gitlabProject->id]);
            }

            // Check if ref already exists
            $exists = TaskGitlabRef::where('task_id', $task->id)
                ->where('ref_type', $refType)
                ->when($gitlabIid, fn ($q) => $q->where('gitlab_iid', $gitlabIid))
                ->when($gitlabRef && ! $gitlabIid, fn ($q) => $q->where('gitlab_ref', $gitlabRef))
                ->exists();

            if ($exists) {
                continue;
            }

            $refs[] = TaskGitlabRef::create([
                'task_id' => $task->id,
                'ref_type' => $refType,
                'gitlab_iid' => $gitlabIid,
                'gitlab_ref' => $gitlabRef,
                'title' => $title,
                'state' => $state,
                'url' => $url ?? '',
                'pipeline_status' => $pipelineStatus,
                'author' => $author,
                'meta' => $meta,
                'last_synced_at' => now(),
            ]);
        }

        return $refs;
    }
}
