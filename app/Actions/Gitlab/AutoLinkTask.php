<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabLink;
use Lorisleiva\Actions\Concerns\AsAction;

class AutoLinkTask
{
    use AsAction;

    /**
     * Parse text for PB-{number} patterns and auto-link matching tasks.
     *
     * @return TaskGitlabLink[] Created links
     */
    public function handle(
        GitlabProject $gitlabProject,
        string $text,
        string $linkType,
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
        $links = [];

        if (! preg_match_all($pattern, $text, $matches)) {
            return $links;
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

            // Check if link already exists
            $exists = TaskGitlabLink::where('task_id', $task->id)
                ->where('gitlab_project_id', $gitlabProject->id)
                ->where('link_type', $linkType)
                ->when($gitlabIid, fn ($q) => $q->where('gitlab_iid', $gitlabIid))
                ->when($gitlabRef && ! $gitlabIid, fn ($q) => $q->where('gitlab_ref', $gitlabRef))
                ->exists();

            if ($exists) {
                continue;
            }

            $links[] = TaskGitlabLink::create([
                'task_id' => $task->id,
                'gitlab_project_id' => $gitlabProject->id,
                'link_type' => $linkType,
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

        return $links;
    }
}
