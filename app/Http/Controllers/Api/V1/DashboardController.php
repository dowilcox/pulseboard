<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Services\TeamStatsService;
use App\Support\PublicUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardController extends Controller
{
    public function teamStats(Request $request, Team $team, TeamStatsService $stats): JsonResponse
    {
        $this->authorize('view', $team);

        return response()->json(PublicUser::scrub($stats->stats($team)));
    }

    public function exportCsv(Request $request, Team $team, TeamStatsService $stats): StreamedResponse
    {
        $this->authorize('view', $team);

        return $stats->exportCsv($team);
    }
}
