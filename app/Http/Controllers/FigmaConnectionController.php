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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;

class FigmaConnectionController extends Controller
{
    /**
     * Figma is managed on the Integrations tab of team settings; this URL is
     * kept so old links and bookmarks still land in the right place.
     */
    public function index(Request $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        $request->session()->reflash();

        return Redirect::route('teams.settings', ['team' => $team, 'tab' => 'integrations']);
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

        return Redirect::back()->with('success', 'Figma connection created.');
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

        return Redirect::back()->with('success', 'Figma connection updated.');
    }

    public function destroy(
        Team $team,
        FigmaConnection $figmaConnection,
    ): RedirectResponse {
        $this->authorize('update', $team);

        DeleteFigmaConnection::run($figmaConnection);

        return Redirect::back()->with('success', 'Figma connection deleted.');
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
            Log::warning('Figma connection test failed', [
                'connection_id' => $figmaConnection->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(
                [
                    'success' => false,
                    'message' => 'Connection test failed. Check your credentials and try again.',
                ],
                422,
            );
        }
    }
}
