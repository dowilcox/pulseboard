<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Services\GitlabApiService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
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

        // Collect and delete attachment files
        $boards = $team->boards()->with('tasks.attachments')->get();
        $filePaths = $boards->flatMap(fn ($board) => $board->tasks->flatMap(
            fn ($task) => $task->attachments->pluck('file_path')
        ));

        foreach ($filePaths as $path) {
            Storage::disk('local')->delete($path);
        }

        // FK cascades handle all DB records
        $team->delete();
    }
}
