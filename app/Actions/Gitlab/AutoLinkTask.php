<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabRef;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Lorisleiva\Actions\Concerns\AsAction;

class AutoLinkTask
{
    use AsAction;

    /**
     * Parse text for #{number} and pb-{number}- patterns and auto-link
     * matching tasks.
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

        $taskNumbers = array_unique(array_map('intval', $matches[1]));

        // Active boards belonging to this project's team. Archived boards are
        // read-only history, so new GitLab activity never links to them.
        $boardIds = $gitlabProject->team->boards()->active()->pluck('id');

        // Task numbers are only unique per board, so one number can match a
        // task on several boards. Tasks linked to a different GitLab project
        // are never candidates.
        $candidatesByNumber = Task::whereIn('board_id', $boardIds)
            ->whereIn('task_number', $taskNumbers)
            ->where(fn ($q) => $q->whereNull('gitlab_project_id')
                ->orWhere('gitlab_project_id', $gitlabProject->id))
            ->get()
            ->groupBy('task_number');

        foreach ($taskNumbers as $taskNumber) {
            $task = $this->resolveTask(
                $candidatesByNumber->get($taskNumber, collect()),
                $gitlabProject,
            );

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

    /**
     * Pick the single task a reference points to, preferring one already
     * linked to this project. Ambiguous references are skipped rather than
     * linked to an arbitrary board's task.
     *
     * @param  Collection<int, Task>  $candidates
     */
    protected function resolveTask(Collection $candidates, GitlabProject $gitlabProject): ?Task
    {
        if ($candidates->count() > 1) {
            $linked = $candidates->where('gitlab_project_id', $gitlabProject->id);

            if ($linked->count() !== 1) {
                Log::info('GitLab auto-link skipped ambiguous task reference', [
                    'gitlab_project_id' => $gitlabProject->id,
                    'task_number' => $candidates->first()->task_number,
                    'board_ids' => $candidates->pluck('board_id')->all(),
                ]);

                return null;
            }

            return $linked->first();
        }

        return $candidates->first();
    }
}
