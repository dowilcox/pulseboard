<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\AssignTask as AssignTaskAction;
use App\Mcp\Support\Presenter;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('assign_task')]
#[Description('Change a task\'s assignees. mode "add" (default) adds the given users, "remove" removes them, "set" replaces the whole list (an empty list unassigns everyone). Users are "me", user UUIDs or emails of active team members (see get_board). Newly assigned users are notified. Requires a token with the "write" ability.')]
class AssignTask extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('Task UUID, or task number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug". Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'users' => $schema->array()->items($schema->string())->description('"me", user UUIDs, or emails.')->required(),
            'mode' => $schema->string()->enum(['add', 'remove', 'set'])->description('Default "add".'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'users' => ['present', 'array', 'max:50'],
            'users.*' => ['string', 'max:255'],
            'mode' => ['nullable', 'in:add,remove,set'],
        ]);

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));

        $this->authorizeFor($user, 'assign', $task, 'You are not allowed to assign this task.');

        $mode = $request->get('mode') ?? 'add';
        $current = $task->assignees()->pluck('users.id')->all();

        if ($mode === 'remove') {
            // Removal also accepts ids of users who have since left the team.
            $remove = collect($request->get('users'))
                ->map(fn ($ref) => mb_strtolower(trim((string) $ref)) === 'me' ? $user->id : trim((string) $ref))
                ->all();
            $emails = User::query()->whereIn('id', $current)->pluck('id', 'email')->mapWithKeys(fn ($id, $email) => [mb_strtolower($email) => $id]);
            $remove = array_map(fn ($ref) => $emails[mb_strtolower($ref)] ?? $ref, $remove);
            $ids = array_values(array_diff($current, $remove));
        } else {
            $ids = $this->resolveMemberIds($user, $task->board->team, $request->get('users'));

            if ($mode === 'add') {
                $ids = array_values(array_unique([...$current, ...$ids]));
            }
        }

        $task = AssignTaskAction::run($task, $ids, $user);

        return $this->json([
            'assignees' => $task->assignees->map(fn (User $u) => Presenter::user($u))->values()->all(),
            'task' => Presenter::relatedTask($task),
        ]);
    }
}
