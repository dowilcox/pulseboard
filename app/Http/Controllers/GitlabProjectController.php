<?php

namespace App\Http\Controllers;

use App\Actions\Gitlab\LinkGitlabProject;
use App\Actions\Gitlab\UnlinkGitlabProject;
use App\Exceptions\GitlabApiException;
use App\Models\GitlabConnection;
use App\Models\GitlabProject;
use App\Models\Team;
use App\Services\GitlabApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class GitlabProjectController extends Controller
{
    public function index(Team $team): Response
    {
        $this->authorize('update', $team);

        $projects = $team->gitlabProjects()
            ->with('connection')
            ->orderBy('name')
            ->get();

        $connections = GitlabConnection::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'base_url']);

        return Inertia::render('Teams/Settings/GitlabProjects', [
            'team' => $team,
            'gitlabProjects' => $projects,
            'connections' => $connections,
        ]);
    }

    public function search(Request $request, Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        $request->validate([
            'connection_id' => ['required', 'exists:gitlab_connections,id'],
            'q' => ['required', 'string', 'min:2'],
        ]);

        $connection = GitlabConnection::findOrFail($request->connection_id);

        try {
            $api = GitlabApiService::for($connection);
            $projects = $api->searchProjects($request->q);

            // Filter out already linked projects
            $linkedIds = $team->gitlabProjects()
                ->where('gitlab_connection_id', $connection->id)
                ->pluck('gitlab_project_id')
                ->toArray();

            $results = collect($projects)
                ->filter(fn ($p) => ! in_array($p['id'], $linkedIds))
                ->map(fn ($p) => [
                    'id' => $p['id'],
                    'name' => $p['name'],
                    'path_with_namespace' => $p['path_with_namespace'],
                    'web_url' => $p['web_url'],
                    'default_branch' => $p['default_branch'] ?? 'main',
                ])
                ->values();

            return response()->json($results);
        } catch (GitlabApiException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function store(Request $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        $validated = $request->validate([
            'connection_id' => ['required', 'exists:gitlab_connections,id'],
            'gitlab_project_id' => ['required', 'integer'],
        ]);

        $connection = GitlabConnection::findOrFail($validated['connection_id']);

        LinkGitlabProject::run($team, $connection, $validated['gitlab_project_id']);

        return Redirect::route('teams.gitlab-projects.index', $team);
    }

    public function destroy(Team $team, GitlabProject $gitlabProject): RedirectResponse
    {
        $this->authorize('update', $team);

        UnlinkGitlabProject::run($gitlabProject);

        return Redirect::route('teams.gitlab-projects.index', $team);
    }
}
