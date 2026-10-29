<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Presenter;
use App\Mcp\Support\RichText;
use App\Models\Activity;
use App\Models\Comment;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Carbon;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get_board_activity')]
#[Description('Recent activity on a board since a point in time, newest first: tasks created, moved, completed/reopened, assigned, relabelled, edited, commented on (with a comment preview), dependencies changed. Useful for "catch me up" and stand-up summaries. Defaults to the last 24 hours.')]
#[IsReadOnly]
class GetBoardActivity extends PulseBoardTool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug".')->required(),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'since' => $schema->string()->description('ISO 8601 date or datetime (e.g. "2026-10-27" or "2026-10-27T09:00:00Z"). Default: 24 hours ago.'),
            'actions' => $schema->array()->items($schema->string())->description('Only these action types, e.g. ["created","moved","completed","commented"].'),
            'limit' => $schema->integer()->min(1)->max(200)->description('Max entries (default 50, max 200).'),
            'offset' => $schema->integer()->min(0)->description('Number of entries to skip, for pagination.'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'board' => ['required', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'since' => ['nullable', 'date'],
            'actions' => ['nullable', 'array', 'max:30'],
            'actions.*' => ['string', 'max:64'],
            'limit' => ['nullable', 'integer', 'min:1'],
            'offset' => ['nullable', 'integer', 'min:0'],
        ]);

        $board = $this->resolveBoard($user, $request->get('board'), $request->get('team'));
        $since = filled($request->get('since'))
            ? Carbon::parse($request->get('since'))
            : now()->subDay();

        $query = Activity::query()
            ->whereIn('task_id', $board->tasks()->select('id'))
            ->where('created_at', '>=', $since)
            ->when(filled($request->get('actions')), fn ($q) => $q->whereIn('action', $request->get('actions')));

        $total = (clone $query)->count();
        $limit = $this->limit($request);
        $offset = $this->offset($request);

        $activities = $query
            ->with([
                'user:id,name',
                'task:id,board_id,task_number,title',
                'task.board:id,team_id,slug',
            ])
            ->orderByDesc('created_at')
            ->offset($offset)
            ->limit($limit)
            ->get();

        $commentIds = $activities
            ->where('action', 'commented')
            ->map(fn (Activity $a) => $a->changes['comment_id'] ?? null)
            ->filter()
            ->values();

        $customFields = $board->customFields()->get();

        $comments = $commentIds->isNotEmpty()
            ? Comment::query()->whereIn('id', $commentIds)->get(['id', 'body'])->keyBy('id')
            : collect();

        return $this->page(
            'activity',
            $activities->map(function (Activity $activity) use ($comments, $customFields) {
                $comment = $comments->get($activity->changes['comment_id'] ?? '');

                return Presenter::activity($activity, $comment ? [
                    'comment' => ['id' => $comment->id, 'preview' => RichText::preview($comment->body, 300)],
                ] : [], $customFields);
            })->values()->all(),
            $total,
            $offset,
            $limit,
            [
                'board' => Presenter::board($board),
                'since' => Presenter::timestamp($since),
            ],
        );
    }
}
