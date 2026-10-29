<?php

namespace App\Mcp\Tools;

use App\Mcp\Exceptions\ToolException;
use App\Mcp\Tools\Concerns\ResolvesModels;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Base class for PulseBoard MCP tools.
 *
 * - Resolves the Sanctum-authenticated user and enforces the token ability
 *   the tool needs ($ability), mirroring routes/api.php: reads need no extra
 *   ability, content mutations need "write".
 * - Converts expected failures (ToolException, policy denials, missing
 *   records, abort()s inside actions) into tool errors the agent can read.
 *   Validation errors are converted by laravel/mcp itself.
 *
 * Tools are resolved from the container per request and must not keep state
 * in static properties (Octane workers are long-lived).
 */
abstract class PulseBoardTool extends Tool
{
    use ResolvesModels;

    /**
     * Token ability required to call the tool, or null for read-only tools.
     */
    protected ?string $ability = null;

    private const IDENTIFIER_ARGUMENTS = ['task', 'board', 'team', 'column', 'parent', 'parent_task', 'depends_on', 'target_board'];

    public function handle(Request $request): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return Response::error('Unauthenticated. Connect with a PulseBoard API token (Authorization: Bearer <token>).');
        }

        // Agents often send task numbers as JSON numbers; identifiers are
        // validated as strings.
        foreach (self::IDENTIFIER_ARGUMENTS as $key) {
            if (is_int($value = $request->get($key))) {
                $request->merge([$key => (string) $value]);
            }
        }

        try {
            if ($this->ability !== null) {
                $this->ensureTokenAbility($user, $this->ability);
            }

            return $this->run($request, $user);
        } catch (ToolException $e) {
            return Response::error($e->getMessage());
        } catch (AuthorizationException $e) {
            return Response::error($e->getMessage() ?: 'You are not allowed to do that.');
        } catch (ModelNotFoundException) {
            return Response::error('The requested record was not found.');
        } catch (HttpExceptionInterface $e) {
            return Response::error($e->getMessage() ?: "Request failed (HTTP {$e->getStatusCode()}).");
        }
    }

    abstract protected function run(Request $request, User $user): Response;

    protected function ensureTokenAbility(User $user, string $ability): void
    {
        if ($user->currentAccessToken() === null || ! $user->tokenCan($ability)) {
            throw new ToolException(
                "Permission denied: this tool changes data and requires an API token with the \"{$ability}\" ability, "
                .'which the current token does not have. Ask the user for a token with write access (Profile → API tokens).'
            );
        }
    }

    /**
     * Policy check that reports a readable tool error instead of a 403.
     */
    protected function authorizeFor(User $user, string $ability, mixed $arguments, string $message): void
    {
        if (Gate::forUser($user)->denies($ability, $arguments)) {
            throw new ToolException($message);
        }
    }

    protected function limit(Request $request, ?int $default = null): int
    {
        $max = (int) config('mcp_server.max_limit', 200);
        $default ??= (int) config('mcp_server.default_limit', 50);
        $limit = (int) ($request->get('limit') ?? $default);

        return max(1, min($limit, $max));
    }

    protected function offset(Request $request): int
    {
        return max(0, (int) ($request->get('offset') ?? 0));
    }

    /**
     * Encode tool output as compact JSON text.
     */
    protected function json(array $data): Response
    {
        return Response::text(json_encode(
            $data,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE,
        ));
    }

    /**
     * Pagination envelope for list tools.
     */
    protected function page(string $key, array $items, int $total, int $offset, int $limit, array $extra = []): Response
    {
        $hasMore = $offset + count($items) < $total;

        return $this->json([
            ...$extra,
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => $hasMore,
            ...($hasMore ? ['next_offset' => $offset + count($items)] : []),
            $key => $items,
        ]);
    }
}
