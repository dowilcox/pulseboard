<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Gitlab\CreateGitlabConnection;
use App\Actions\Gitlab\DeleteGitlabConnection;
use App\Actions\Gitlab\UpdateGitlabConnection;
use App\Exceptions\GitlabApiException;
use App\Http\Controllers\Controller;
use App\Models\GitlabConnection;
use App\Services\GitlabApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class GitlabConnectionController extends Controller
{
    public function index(): Response
    {
        $connections = GitlabConnection::orderBy('name')->get();

        return Inertia::render('Admin/GitlabConnections', [
            'connections' => $connections,
        ]);
    }

    public function show(GitlabConnection $gitlabConnection): JsonResponse
    {
        $gitlabConnection->load(['projects.team']);

        $totalProjects = $gitlabConnection->projects->count();
        $projectsWithWebhooks = $gitlabConnection->projects->filter(fn ($p) => $p->webhook_id !== null)->count();

        return response()->json([
            'connection' => $gitlabConnection,
            'projects' => $gitlabConnection->projects->map(fn ($project) => [
                'id' => $project->id,
                'name' => $project->name,
                'path_with_namespace' => $project->path_with_namespace,
                'web_url' => $project->web_url,
                'default_branch' => $project->default_branch,
                'webhook_id' => $project->webhook_id,
                'last_synced_at' => $project->last_synced_at?->toISOString(),
                'team_name' => $project->team?->name ?? 'Unknown',
                'team_id' => $project->team_id,
            ]),
            'stats' => [
                'total_projects' => $totalProjects,
                'projects_with_webhooks' => $projectsWithWebhooks,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'base_url' => ['required', 'url', 'max:500'],
            'api_token' => ['required', 'string'],
            'is_active' => ['boolean'],
        ]);

        CreateGitlabConnection::run($validated);

        return Redirect::route('admin.gitlab-connections.index')
            ->with('success', 'GitLab connection created successfully.');
    }

    public function update(Request $request, GitlabConnection $gitlabConnection): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'base_url' => ['required', 'url', 'max:500'],
            'api_token' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        UpdateGitlabConnection::run($gitlabConnection, $validated);

        return Redirect::route('admin.gitlab-connections.index')
            ->with('success', 'GitLab connection updated successfully.');
    }

    public function destroy(GitlabConnection $gitlabConnection): RedirectResponse
    {
        DeleteGitlabConnection::run($gitlabConnection);

        return Redirect::route('admin.gitlab-connections.index')
            ->with('success', 'GitLab connection deleted successfully.');
    }

    public function testConnection(GitlabConnection $gitlabConnection): JsonResponse
    {
        try {
            $api = GitlabApiService::for($gitlabConnection);
            $user = $api->testConnection();

            return response()->json([
                'success' => true,
                'message' => "Connected as {$user['name']} ({$user['username']})",
            ]);
        } catch (GitlabApiException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
