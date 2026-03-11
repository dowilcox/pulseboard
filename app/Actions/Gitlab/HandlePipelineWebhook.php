<?php

namespace App\Actions\Gitlab;

use App\Events\BoardChanged;
use App\Models\GitlabProject;
use App\Models\TaskGitlabRef;
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
            ->get();

        foreach ($refs as $gitlabRef) {
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
        }
    }
}
