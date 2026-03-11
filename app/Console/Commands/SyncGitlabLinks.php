<?php

namespace App\Console\Commands;

use App\Exceptions\GitlabApiException;
use App\Models\TaskGitlabRef;
use App\Services\GitlabApiService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SyncGitlabLinks extends Command
{
    protected $signature = 'gitlab:sync-refs';

    protected $description = 'Sync stale GitLab ref data (MR status, pipeline status)';

    public function handle(): int
    {
        $syncInterval = config('gitlab.sync_interval', 15);

        $staleRefs = TaskGitlabRef::where('ref_type', 'merge_request')
            ->where(function ($q) use ($syncInterval) {
                $q->where('last_synced_at', '<', now()->subMinutes($syncInterval))
                    ->orWhereNull('last_synced_at');
            })
            ->whereHas('task.gitlabProject.connection', function ($q) {
                $q->where('is_active', true);
            })
            ->with('task.gitlabProject.connection')
            ->limit(100)
            ->get();

        if ($staleRefs->isEmpty()) {
            $this->info('No stale refs to sync.');

            return self::SUCCESS;
        }

        $this->info("Syncing {$staleRefs->count()} stale GitLab refs...");

        $synced = 0;
        $errors = 0;

        // Group by connection to reuse API clients
        $grouped = $staleRefs->groupBy(fn ($ref) => $ref->task->gitlabProject->gitlab_connection_id);

        foreach ($grouped as $connectionId => $refs) {
            $connection = $refs->first()->task->gitlabProject->connection;
            $api = GitlabApiService::for($connection);

            foreach ($refs as $ref) {
                try {
                    $mrData = $api->getMergeRequest(
                        $ref->task->gitlabProject->gitlab_project_id,
                        $ref->gitlab_iid,
                    );

                    $updates = [
                        'title' => $mrData['title'] ?? $ref->title,
                        'state' => $mrData['state'] ?? $ref->state,
                        'author' => $mrData['author']['name'] ?? $ref->author,
                        'last_synced_at' => now(),
                    ];

                    // Check pipeline status if we have a ref
                    if ($ref->gitlab_ref) {
                        try {
                            $pipeline = $api->getPipelineStatus(
                                $ref->task->gitlabProject->gitlab_project_id,
                                $ref->gitlab_ref,
                            );
                            if (! empty($pipeline)) {
                                $updates['pipeline_status'] = $pipeline['status'] ?? null;
                            }
                        } catch (GitlabApiException) {
                            // Pipeline check is optional
                        }
                    }

                    $ref->update($updates);
                    $synced++;
                } catch (GitlabApiException $e) {
                    $errors++;
                    Log::warning("Failed to sync GitLab ref {$ref->id}: {$e->getMessage()}");
                }
            }
        }

        $this->info("Synced: {$synced}, Errors: {$errors}");

        return self::SUCCESS;
    }
}
