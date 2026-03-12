<?php

namespace App\Http\Controllers;

use App\Actions\Gitlab\CreateGitlabConnection;
use App\Actions\Gitlab\DeleteGitlabConnection;
use App\Actions\Gitlab\UpdateGitlabConnection;
use App\Exceptions\GitlabApiException;
use App\Models\GitlabConnection;
use App\Models\Team;
use App\Services\GitlabApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;

class GitlabConnectionController extends Controller
{
    public function store(Request $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'base_url' => ['required', 'url', 'max:500'],
            'api_token' => ['required', 'string'],
            'is_active' => ['boolean'],
        ]);

        CreateGitlabConnection::run($team, $validated);

        return Redirect::route('teams.gitlab-projects.index', $team)
            ->with('success', 'GitLab connection created successfully.');
    }

    public function update(Request $request, Team $team, GitlabConnection $gitlabConnection): RedirectResponse
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'base_url' => ['required', 'url', 'max:500'],
            'api_token' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        UpdateGitlabConnection::run($gitlabConnection, $validated);

        return Redirect::route('teams.gitlab-projects.index', $team)
            ->with('success', 'GitLab connection updated successfully.');
    }

    public function destroy(Team $team, GitlabConnection $gitlabConnection): RedirectResponse
    {
        $this->authorize('update', $team);

        DeleteGitlabConnection::run($gitlabConnection);

        return Redirect::route('teams.gitlab-projects.index', $team)
            ->with('success', 'GitLab connection deleted successfully.');
    }

    public function test(Team $team, GitlabConnection $gitlabConnection): JsonResponse
    {
        $this->authorize('update', $team);

        try {
            $api = GitlabApiService::for($gitlabConnection);
            $user = $api->testConnection();

            return response()->json([
                'success' => true,
                'message' => "Connected as {$user['name']} ({$user['username']})",
            ]);
        } catch (GitlabApiException $e) {
            Log::warning('GitLab connection test failed', [
                'connection_id' => $gitlabConnection->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Connection test failed. Check your credentials and try again.',
            ], 422);
        }
    }
}
