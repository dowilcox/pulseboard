<?php

namespace App\Http\Controllers;

use App\Actions\Figma\CreateFigmaConnection;
use App\Actions\Figma\DeleteFigmaConnection;
use App\Actions\Figma\UpdateFigmaConnection;
use App\Exceptions\FigmaApiException;
use App\Models\FigmaConnection;
use App\Models\Team;
use App\Services\FigmaApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class FigmaConnectionController extends Controller
{
    public function index(Team $team): Response
    {
        $this->authorize('update', $team);

        $connections = $team->figmaConnections()->orderBy('name')->get();

        return Inertia::render('Teams/Settings/FigmaIntegration', [
            'team' => $team,
            'connections' => $connections,
        ]);
    }

    public function store(Request $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'api_token' => ['required', 'string'],
            'is_active' => ['boolean'],
        ]);

        CreateFigmaConnection::run($team, $validated);

        return Redirect::route('teams.figma.index', $team)->with(
            'success',
            'Figma connection created successfully.',
        );
    }

    public function update(
        Request $request,
        Team $team,
        FigmaConnection $figmaConnection,
    ): RedirectResponse {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'api_token' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        UpdateFigmaConnection::run($figmaConnection, $validated);

        return Redirect::route('teams.figma.index', $team)->with(
            'success',
            'Figma connection updated successfully.',
        );
    }

    public function destroy(
        Team $team,
        FigmaConnection $figmaConnection,
    ): RedirectResponse {
        $this->authorize('update', $team);

        DeleteFigmaConnection::run($figmaConnection);

        return Redirect::route('teams.figma.index', $team)->with(
            'success',
            'Figma connection deleted successfully.',
        );
    }

    public function test(
        Team $team,
        FigmaConnection $figmaConnection,
    ): JsonResponse {
        $this->authorize('update', $team);

        try {
            $api = FigmaApiService::for($figmaConnection);
            $user = $api->testConnection();

            return response()->json([
                'success' => true,
                'message' => "Connected as {$user['handle']} ({$user['email']})",
            ]);
        } catch (FigmaApiException $e) {
            return response()->json(
                [
                    'success' => false,
                    'message' => $e->getMessage(),
                ],
                422,
            );
        }
    }
}
