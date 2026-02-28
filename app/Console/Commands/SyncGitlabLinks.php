<?php

namespace App\Console\Commands;

use App\Exceptions\GitlabApiException;
use App\Models\TaskGitlabLink;
use App\Services\GitlabApiService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SyncGitlabLinks extends Command
{
    protected $signature = 'gitlab:sync-links';

    protected $description = 'Sync stale GitLab link data (MR status, pipeline status)';

    public function handle(): int
    {
        $syncInterval = config('gitlab.sync_interval', 15);

        $staleLinks = TaskGitlabLink::where('link_type', 'merge_request')
            ->where(function ($q) use ($syncInterval) {
                $q->where('last_synced_at', '<', now()->subMinutes($syncInterval))
                    ->orWhereNull('last_synced_at');
            })
            ->whereHas('gitlabProject.connection', function ($q) {
                $q->where('is_active', true);
            })
            ->with('gitlabProject.connection')
            ->limit(100)
            ->get();

        if ($staleLinks->isEmpty()) {
            $this->info('No stale links to sync.');

            return self::SUCCESS;
        }

        $this->info("Syncing {$staleLinks->count()} stale GitLab links...");

        $synced = 0;
        $errors = 0;

        // Group by connection to reuse API clients
        $grouped = $staleLinks->groupBy(fn ($link) => $link->gitlabProject->gitlab_connection_id);

        foreach ($grouped as $connectionId => $links) {
            $connection = $links->first()->gitlabProject->connection;
            $api = GitlabApiService::for($connection);

            foreach ($links as $link) {
                try {
                    $mrData = $api->getMergeRequest(
                        $link->gitlabProject->gitlab_project_id,
                        $link->gitlab_iid,
                    );

                    $updates = [
                        'title' => $mrData['title'] ?? $link->title,
                        'state' => $mrData['state'] ?? $link->state,
                        'author' => $mrData['author']['name'] ?? $link->author,
                        'last_synced_at' => now(),
                    ];

                    // Check pipeline status if we have a ref
                    if ($link->gitlab_ref) {
                        try {
                            $pipeline = $api->getPipelineStatus(
                                $link->gitlabProject->gitlab_project_id,
                                $link->gitlab_ref,
                            );
                            if (! empty($pipeline)) {
                                $updates['pipeline_status'] = $pipeline['status'] ?? null;
                            }
                        } catch (GitlabApiException) {
                            // Pipeline check is optional
                        }
                    }

                    $link->update($updates);
                    $synced++;
                } catch (GitlabApiException $e) {
                    $errors++;
                    Log::warning("Failed to sync GitLab link {$link->id}: {$e->getMessage()}");
                }
            }
        }

        $this->info("Synced: {$synced}, Errors: {$errors}");

        return self::SUCCESS;
    }
}
