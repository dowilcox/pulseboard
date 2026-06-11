<?php

namespace App\Actions\Gitlab;

use App\Events\BoardChanged;
use App\Models\GitlabProject;
use App\Models\TaskGitlabRef;
use App\Services\TaskAutomationDispatcher;
use Lorisleiva\Actions\Concerns\AsAction;

class HandlePipelineWebhook
{
    use AsAction;

    public function handle(GitlabProject $gitlabProject, array $payload): void
    {
        $pipelineData = $payload['object_attributes'] ?? [];
        $ref = $pipelineData['ref'] ?? null;
        $status = $pipelineData['status'] ?? null;

        if (! $ref || ! $status) {
            return;
        }

        // Find all refs matching this project + branch ref (via task's gitlab_project_id)
        $refs = TaskGitlabRef::whereHas('task', function ($q) use ($gitlabProject) {
            $q->where('gitlab_project_id', $gitlabProject->id);
        })
            ->where('gitlab_ref', $ref)
            ->with('task')
            ->get();

        $dispatcher = app(TaskAutomationDispatcher::class);
        $firedTaskIds = [];

        foreach ($refs as $gitlabRef) {
            $previousStatus = $gitlabRef->pipeline_status;

            $gitlabRef->update([
                'pipeline_status' => $status,
                'last_synced_at' => now(),
            ]);

            broadcast(new BoardChanged(
                boardId: $gitlabRef->task->board_id,
                action: 'gitlab_pipeline_updated',
                data: [
                    'task_id' => $gitlabRef->task_id,
                    'pipeline_status' => $status,
                    'ref' => $ref,
                ],
                userId: 'system',
            ));

            // Fire board automations when the pipeline status changes,
            // at most once per task per webhook delivery.
            if ($previousStatus !== $status && ! in_array($gitlabRef->task_id, $firedTaskIds, true)) {
                $firedTaskIds[] = $gitlabRef->task_id;

                $dispatcher->dispatchTrigger($gitlabRef->task, 'gitlab_pipeline_status', [
                    'pipeline_status' => $status,
                    'ref' => $ref,
                ]);
            }
        }
    }
}
