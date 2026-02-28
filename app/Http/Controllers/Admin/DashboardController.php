<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\GitlabConnection;
use App\Models\Team;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'totalUsers' => User::count(),
                'activeUsers' => User::active()->count(),
                'totalTeams' => Team::count(),
                'totalBoards' => Board::count(),
                'gitlabConnections' => GitlabConnection::where('is_active', true)->count(),
            ],
        ]);
    }
}
