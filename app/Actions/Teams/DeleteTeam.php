<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Services\GitlabApiService;
use Illuminate\Support\Facades\Log;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteTeam
{
    use AsAction;

    public function handle(Team $team): void
    {
        // Best-effort webhook cleanup for all GitLab connections
        $connections = $team->gitlabConnections()->with('projects')->get();

        foreach ($connections as $connection) {
            $api = GitlabApiService::for($connection);

            foreach ($connection->projects as $project) {
                if ($project->webhook_id) {
                    try {
                        $api->deleteWebhook($project->gitlab_project_id, $project->webhook_id);
                    } catch (\Exception $e) {
                        Log::warning("Failed to remove webhook for project {$project->path_with_namespace}: {$e->getMessage()}");
                    }
                }
            }
        }

        // Delete boards and their tasks via Eloquent to trigger media library cleanup
        $team->boards()->each(function ($board) {
            $board->tasks()->each(function ($task) {
                $task->delete();
            });
            $board->delete();
        });

        // FK cascades handle remaining DB records
        $team->delete();
    }
}
