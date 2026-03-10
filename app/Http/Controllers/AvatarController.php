<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class AvatarController extends Controller
{
    private const COLORS = [
        '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#14b8a6', '#06b6d4', '#3b82f6', '#6d28d9',
    ];

    public function show(User $user): Response|RedirectResponse
    {
        $hash = md5(strtolower(trim($user->email)));
        $gravatarUrl = "https://www.gravatar.com/avatar/{$hash}?s=80";

        $hasGravatar = Cache::remember(
            "gravatar:{$user->id}",
            86400,
            function () use ($gravatarUrl) {
                try {
                    $response = Http::timeout(3)->head("{$gravatarUrl}&d=404");

                    return $response->status() === 200;
                } catch (\Throwable) {
                    return false;
                }
            }
        );

        if ($hasGravatar) {
            return redirect($gravatarUrl, 302, [
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        return $this->svgResponse($user);
    }

    private function svgResponse(User $user): Response
    {
        $initials = $this->getInitials($user->name);
        $color = self::COLORS[crc32($user->name) % count(self::COLORS)];

        $svg = <<<SVG
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="40" fill="{$color}"/>
            <text x="40" y="40" text-anchor="middle" dominant-baseline="central"
                  fill="white" font-family="system-ui, -apple-system, sans-serif"
                  font-size="32" font-weight="600">{$initials}</text>
        </svg>
        SVG;

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    private function getInitials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));

        if (count($parts) >= 2) {
            return mb_strtoupper(mb_substr($parts[0], 0, 1).mb_substr(end($parts), 0, 1));
        }

        return mb_strtoupper(mb_substr($parts[0], 0, 1));
    }
}
