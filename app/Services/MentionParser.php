<?php

namespace App\Services;

use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Collection;

class MentionParser
{
    /**
     * Extract user IDs from mention HTML tags in content.
     *
     * Mentions are stored as: <span data-type="mention" data-id="uuid">@Name</span>
     *
     * @return string[] Array of user UUIDs
     */
    public static function extractUserIds(string $content): array
    {
        preg_match_all(
            '/<span[^>]*data-type="mention"[^>]*data-id="([^"]+)"[^>]*>/',
            $content,
            $matches,
        );

        return array_unique($matches[1] ?? []);
    }

    /**
     * Find User models for the mentioned IDs, excluding certain users.
     */
    public static function findMentionedUsers(
        string $content,
        array $excludeIds = [],
        ?Team $team = null,
    ): Collection {
        $userIds = static::extractUserIds($content);

        return static::queryMentionedUsers($userIds, $excludeIds, $team);
    }

    public static function queryMentionedUsers(
        array $userIds,
        array $excludeIds = [],
        ?Team $team = null,
    ): Collection {
        if (empty($userIds)) {
            return collect();
        }

        $query = User::whereIn('id', $userIds)
            ->whereNull('deactivated_at');

        if ($team) {
            $query->whereHas('teams', fn ($teamQuery) => $teamQuery->where('teams.id', $team->id));
        }

        if (! empty($excludeIds)) {
            $query->whereNotIn('id', $excludeIds);
        }

        return $query->get();
    }

    /**
     * Find newly-added mentions by comparing old and new content.
     *
     * Returns User models mentioned in $newContent but not in $oldContent.
     */
    public static function findNewMentions(
        ?string $oldContent,
        string $newContent,
        array $excludeIds = [],
        ?Team $team = null,
    ): Collection {
        $oldIds = $oldContent ? static::extractUserIds($oldContent) : [];
        $newIds = static::extractUserIds($newContent);
        $addedIds = array_diff($newIds, $oldIds);

        if (empty($addedIds)) {
            return collect();
        }

        $allExclude = array_merge($excludeIds, $oldIds);

        return static::queryMentionedUsers(
            array_values($addedIds),
            array_unique($allExclude),
            $team,
        );
    }
}
