<?php

namespace App\Services;

class FigmaUrlParser
{
    /**
     * Parse a Figma URL into its components.
     *
     * @return array{file_key: string, node_id: string|null}|null
     */
    public static function parse(string $url): ?array
    {
        $pattern = "#figma\.com/(design|file|board)/([a-zA-Z0-9]+)#";

        if (! preg_match($pattern, $url, $matches)) {
            return null;
        }

        $fileKey = $matches[2];

        // Extract node-id from query string (uses hyphens in URLs, colons in API)
        $nodeId = null;
        if (preg_match('/[?&]node-id=([0-9]+-[0-9]+)/', $url, $nodeMatches)) {
            $nodeId = str_replace('-', ':', $nodeMatches[1]);
        }

        return [
            'file_key' => $fileKey,
            'node_id' => $nodeId,
        ];
    }

    public static function isValid(string $url): bool
    {
        return self::parse($url) !== null;
    }
}
