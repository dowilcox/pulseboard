<?php

namespace App\Http\Controllers;

use App\Actions\Gitlab\LinkGitlabProject;
use App\Actions\Gitlab\UnlinkGitlabProject;
use App\Exceptions\GitlabApiException;
use App\Models\GitlabProject;
use App\Models\Team;
use App\Services\GitlabApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;

class GitlabProjectController extends Controller
{
    /**
     * GitLab is managed on the Integrations tab of team settings; this URL is
     * kept so old links (and redirects from other controllers) still work.
     */
    public function index(Request $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        // Keep any flash message from a controller that redirected here.
        $request->session()->reflash();

        return Redirect::route('teams.settings', ['team' => $team, 'tab' => 'integrations']);
    }

    public function search(Request $request, Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        $request->validate([
            'connection_id' => ['required', 'exists:gitlab_connections,id'],
            'q' => ['required', 'string', 'min:2'],
        ]);

        $connection = $team->gitlabConnections()->findOrFail($request->connection_id);

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
            Log::warning('GitLab project search failed', [
                'connection_id' => $connection->id,
                'query' => $request->q,
                'error' => $e->getMessage(),
            ]);

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

        $connection = $team->gitlabConnections()->findOrFail($validated['connection_id']);

        $project = LinkGitlabProject::run($team, $connection, $validated['gitlab_project_id']);

        return Redirect::back()->with('success', "Linked GitLab project “{$project->path_with_namespace}”.");
    }

    public function destroy(Team $team, GitlabProject $gitlabProject): RedirectResponse
    {
        $this->authorize('update', $team);

        $name = $gitlabProject->path_with_namespace;

        UnlinkGitlabProject::run($gitlabProject);

        return Redirect::back()->with('success', "Unlinked GitLab project “{$name}”.");
    }
}
