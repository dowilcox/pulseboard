<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Contracts\Pagination\Paginator;
use Illuminate\Database\Eloquent\Model;
use SplObjectStorage;

/**
 * The public shape of a user, for API responses that show other people.
 *
 * A full User serializes everything except the password and remember token:
 * notification and UI preferences, `is_admin`, SSO identifiers, deactivation
 * state. API clients (bots, scripts, AI agents) only need to know who someone
 * is, so API responses expose just these fields. `/api/v1/me` keeps its own,
 * fuller shape for the caller's own account.
 */
class PublicUser
{
    /** @var list<string> */
    public const FIELDS = ['id', 'name', 'email', 'avatar_url', 'is_bot'];

    /**
     * A team member in public shape, with their role from the membership pivot.
     *
     * @return array{id: string, name: string, email: string, avatar_url: string, is_bot: bool, role: string|null}
     */
    public static function member(User $user): array
    {
        return [
            ...$user->only(self::FIELDS),
            'is_bot' => (bool) $user->is_bot,
            'role' => $user->pivot?->role,
        ];
    }

    /**
     * Restrict every User inside a response payload to the public fields.
     *
     * Walks models, collections, arrays and paginators, including loaded
     * relations at any depth (task assignees, comment authors, activity
     * users, template creators), and limits each User's serialization to
     * FIELDS plus its pivot. Mutates the models in place and returns the
     * payload, so it can wrap the value passed to response()->json().
     *
     * @template T
     *
     * @param  T  $payload
     * @return T
     */
    public static function scrub(mixed $payload): mixed
    {
        self::walk($payload, new SplObjectStorage);

        return $payload;
    }

    private static function walk(mixed $value, SplObjectStorage $seen): void
    {
        if (is_object($value)) {
            if ($seen->contains($value)) {
                return;
            }

            $seen->attach($value);
        }

        if ($value instanceof User) {
            $value->setVisible([...self::FIELDS, 'pivot']);

            return;
        }

        if ($value instanceof Model) {
            foreach ($value->getRelations() as $relation) {
                self::walk($relation, $seen);
            }

            return;
        }

        if ($value instanceof Paginator || $value instanceof CursorPaginator) {
            self::walk($value->items(), $seen);

            return;
        }

        if (is_iterable($value)) {
            foreach ($value as $item) {
                self::walk($item, $seen);
            }
        }
    }
}
