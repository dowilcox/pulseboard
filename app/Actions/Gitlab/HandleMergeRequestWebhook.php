<?php

namespace App\Actions\Gitlab;

use App\Events\BoardChanged;
use App\Models\GitlabProject;
use App\Models\TaskGitlabRef;
use App\Services\TaskAutomationDispatcher;
use Lorisleiva\Actions\Concerns\AsAction;

class HandleMergeRequestWebhook
{
    use AsAction;

    public function handle(GitlabProject $gitlabProject, array $payload): void
    {
        $mrData = $payload['object_attributes'] ?? [];
        $iid = $mrData['iid'] ?? null;
        $state = $mrData['state'] ?? null;
        $title = $mrData['title'] ?? null;
        $description = $mrData['description'] ?? '';
        $sourceBranch = $mrData['source_branch'] ?? '';
        $url = $mrData['url'] ?? '';
        $authorName = $payload['user']['name'] ?? null;

        if (! $iid) {
            return;
        }

        // Build searchable text for auto-linking
        $searchText = implode(' ', [$title, $description, $sourceBranch]);

        // Try to auto-link using #{number} pattern
        $createdRefs = AutoLinkTask::run(
            gitlabProject: $gitlabProject,
            text: $searchText,
            refType: 'merge_request',
            gitlabIid: $iid,
            gitlabRef: $sourceBranch,
            title: $title,
            state: $state,
            url: $url,
            author: $authorName,
            meta: [
                'source_branch' => $sourceBranch,
                'target_branch' => $mrData['target_branch'] ?? '',
            ],
        );

        // Update existing refs for this MR
        $existingRefs = TaskGitlabRef::whereHas('task', function ($q) use ($gitlabProject) {
            $q->where('gitlab_project_id', $gitlabProject->id);
        })
            ->where('ref_type', 'merge_request')
            ->where('gitlab_iid', $iid)
            ->with('task')
            ->get();

        $dispatcher = app(TaskAutomationDispatcher::class);
        $createdRefIds = array_map(fn (TaskGitlabRef $ref) => $ref->id, $createdRefs);

        foreach ($existingRefs as $ref) {
            $previousState = $ref->state;

            $ref->update([
                'title' => $title,
                'state' => $state,
                'url' => $url,
                'author' => $authorName,
                'meta' => array_merge($ref->meta ?? [], [
                    'source_branch' => $sourceBranch,
                    'target_branch' => $mrData['target_branch'] ?? '',
                ]),
                'last_synced_at' => now(),
            ]);

            // Broadcast real-time update
            $action = match ($state) {
                'merged' => 'gitlab_mr_merged',
                'closed' => 'gitlab_mr_closed',
                default => 'gitlab_mr_created',
            };

            broadcast(new BoardChanged(
                boardId: $ref->task->board_id,
                action: $action,
                data: [
                    'task_id' => $ref->task_id,
                    'mr_iid' => $iid,
                    'state' => $state,
                ],
                userId: 'system',
            ));

            // Fire board automations when the MR transitions to merged.
            // Refs just created by AutoLinkTask were stored with the merged
            // state already, so treat them as a fresh transition.
            $justMerged = $state === 'merged'
                && ($previousState !== 'merged' || in_array($ref->id, $createdRefIds, true));

            if ($justMerged) {
                $dispatcher->dispatchTrigger($ref->task, 'gitlab_mr_merged', [
                    'mr_iid' => $iid,
                    'mr_title' => $title,
                    'mr_url' => $url,
                ]);
            }
        }
    }
}
