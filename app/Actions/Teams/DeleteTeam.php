<?php

namespace App\Actions\Teams;

use App\Actions\Gitlab\RemoveProjectWebhook;
use App\Models\Team;
use App\Models\User;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteTeam
{
    use AsAction;

    public function handle(Team $team): void
    {
        // Best-effort webhook cleanup for all GitLab connections
        $connections = $team->gitlabConnections()->with('projects')->get();

        foreach ($connections as $connection) {
            foreach ($connection->projects as $project) {
                RemoveProjectWebhook::run($project->setRelation('connection', $connection));
            }
        }

        // Delete boards and their tasks via Eloquent to trigger media library cleanup
        $team->boards()->each(function ($board) {
            $board->tasks()->each(function ($task) {
                $task->delete();
            });
            $board->delete();
        });

        // Delete bot users owned by this team (users.created_by_team_id is
        // nullOnDelete, so they would otherwise be orphaned forever) and
        // revoke their API tokens.
        $team->bots()->get()->each(function (User $bot) {
            $bot->tokens()->delete();
            $bot->delete();
        });

        // FK cascades handle remaining DB records
        $team->delete();
    }
}
