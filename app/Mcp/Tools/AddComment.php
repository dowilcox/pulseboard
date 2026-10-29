<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\CreateComment;
use App\Mcp\Exceptions\ToolException;
use App\Mcp\Support\Presenter;
use App\Mcp\Support\RichText;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('add_comment')]
#[Description('Add a comment to a task, or reply to an existing comment with `reply_to`. The body is Markdown; mention team members with <@USER_ID> (ids from get_board); notifications go out exactly as for comments made in the web UI. Requires a token with the "write" ability.')]
class AddComment extends PulseBoardTool
{
    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return [
            'task' => $schema->string()->description('Task UUID, or task number together with `board`, or "board-slug#12".')->required(),
            'board' => $schema->string()->description('Board UUID, slug, or "team-slug/board-slug". Required when `task` is a number.'),
            'team' => $schema->string()->description('Team slug or UUID; only needed when a board slug is ambiguous.'),
            'body' => $schema->string()->description('Comment text in Markdown. Mention members with <@USER_ID>.')->required(),
            'reply_to' => $schema->string()->description('UUID of a comment on this task to reply to (from list_comments).'),
        ];
    }

    protected function run(Request $request, User $user): Response
    {
        $request->validate([
            'task' => ['required', 'string', 'max:255'],
            'board' => ['nullable', 'string', 'max:255'],
            'team' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:65535'],
            'reply_to' => ['nullable', 'uuid'],
        ]);

        $task = $this->resolveTask($user, $request->get('task'), $request->get('board'), $request->get('team'));

        // Same check as the REST API: any member who can view the board may comment.
        $this->authorizeFor($user, 'view', $task->board, 'You are not allowed to comment on this task.');

        $replyTo = $request->get('reply_to');

        if ($replyTo && ! $task->comments()->whereKey($replyTo)->exists()) {
            throw new ToolException("Comment \"{$replyTo}\" was not found on this task. Use list_comments to get comment ids.");
        }

        $body = RichText::fromMarkdown($request->get('body'), $task->board->team);

        if (trim(strip_tags((string) $body)) === '' && ! Str::contains((string) $body, 'data-type="mention"')) {
            throw new ToolException('The comment body is empty.');
        }

        $comment = CreateComment::run($task, $body, $user, $replyTo);

        return $this->json([
            'created' => true,
            'comment' => Presenter::comment($comment, false) + Presenter::compact(['parent_id' => $comment->parent_id]),
            'task' => Presenter::relatedTask($task),
        ]);
    }
}
