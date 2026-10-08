<?php

namespace App\Http\Controllers;

use App\Actions\Media\DeleteModelAvatar;
use App\Actions\Media\UploadModelAvatar;
use App\Actions\Teams\CreateTeam;
use App\Actions\Teams\DeleteTeam;
use App\Actions\Teams\UpdateTeam;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Http\Requests\StoreTeamRequest;
use App\Http\Requests\UpdateTeamRequest;
use App\Models\Activity;
use App\Models\Board;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    /**
     * Display a list of the user's teams.
     */
    public function index(): Response
    {
        $teams = auth()->user()
            ->teams()
            ->with('media')
            ->withCount([
                'members' => fn ($query) => $query->whereNull('users.deactivated_at'),
                'boards' => fn ($query) => $query->active(),
            ])
            ->withPivot('role')
            ->orderBy('name')
            ->get();

        return Inertia::render('Teams/Index', [
            'pageTeams' => $teams,
        ]);
    }

    /**
     * Store a newly created team.
     */
    public function store(StoreTeamRequest $request): RedirectResponse
    {
        $team = CreateTeam::run($request->user(), $request->validated());

        return Redirect::route('teams.show', $team);
    }

    /**
     * Display the team dashboard.
     */
    public function show(Request $request, Team $team): Response
    {
        $this->authorize('view', $team);

        $user = $request->user();

        $team->load(['media', 'members' => function ($query) {
            $query->whereNull('deactivated_at')->orderBy('name');
        }]);

        $boards = $team->boards()
            ->active()
            ->with('media')
            ->withCount([
                'tasks as open_tasks_count' => fn ($query) => $query->open(),
                'tasks as overdue_tasks_count' => fn ($query) => $query
                    ->open()
                    ->whereNotNull('due_date')
                    ->where('due_date', '<', now()->toDateString()),
                'tasks as completed_tasks_count' => fn ($query) => $query->completed(),
            ])
            ->withMax('tasks', 'updated_at')
            ->orderBy('sort_order')
            ->get();

        $this->attachLastActivity($boards);

        $archivedBoards = $team->boards()
            ->where('is_archived', true)
            ->with('media')
            ->orderByDesc('updated_at')
            ->get(['id', 'team_id', 'name', 'slug', 'description', 'is_archived', 'sort_order', 'created_at', 'updated_at']);

        // BoardPolicy::update is decided by the user's team role, so one
        // check covers every archived board in this team.
        $canRestoreBoards = $archivedBoards->isNotEmpty()
            && $user->can('update', $archivedBoards->first());

        $canManageTeam = $user->can('update', $team);

        return Inertia::render('Teams/Show', [
            'team' => $team,
            'members' => $team->members,
            'boards' => $boards,
            'archivedBoards' => $archivedBoards,
            'can' => [
                'createBoard' => $user->can('create', [Board::class, $team]),
                'createFromTemplate' => $canManageTeam,
                'manageTeam' => $canManageTeam,
                'manageIntegrations' => $canManageTeam,
                'restoreBoards' => $canRestoreBoards,
                'exportCsv' => $user->can('view', $team),
            ],
        ]);
    }

    /**
     * Update the specified team.
     */
    public function update(UpdateTeamRequest $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        // Renaming regenerates the slug, so redirect to the fresh URL rather
        // than back to the (now stale) previous one.
        $team = UpdateTeam::run($team, $request->validated());

        return Redirect::route('teams.settings', ['team' => $team, 'tab' => 'general'])
            ->with('success', 'Team details saved.');
    }

    /**
     * Delete the specified team.
     */
    public function destroy(ConfirmDeleteRequest $request, Team $team): RedirectResponse
    {
        $this->authorize('delete', $team);

        $name = $team->name;

        DeleteTeam::run($team);

        return Redirect::route('teams.index')
            ->with('success', "Team “{$name}” deleted.");
    }

    /**
     * Display team settings. Every team member can open this page; the `can`
     * flags decide which sections are editable or visible at all.
     */
    public function settings(Request $request, Team $team): Response
    {
        $this->authorize('view', $team);

        $user = $request->user();
        $canUpdate = $user->can('update', $team);

        $sidebarBoards = $team->boards()
            ->active()
            ->select('id', 'team_id', 'name', 'slug', 'sort_order')
            ->with('media')
            ->orderBy('sort_order')
            ->get();
        $labels = $team->labels()->orderBy('name')->get();
        $activeMembers = $team->members()->whereNull('deactivated_at')->orderBy('name')->get();
        $deactivatedMembers = $team->members()->whereNotNull('deactivated_at')->orderBy('name')->get();

        $tab = $request->query('tab');

        return Inertia::render('Teams/Settings', [
            'team' => $team,
            'sidebarBoards' => $sidebarBoards,
            'labels' => $labels,
            'members' => $activeMembers,
            'deactivatedMembers' => $deactivatedMembers,
            'tab' => is_string($tab) ? $tab : null,
            'can' => [
                'updateTeam' => $canUpdate,
                'manageMembers' => $user->can('manageMember', $team),
                'manageAdmins' => $user->can('manageAdmin', $team),
                'manageLabels' => $canUpdate,
                'manageIntegrations' => $canUpdate,
                'manageBots' => $canUpdate,
                'deleteTeam' => $user->can('delete', $team),
            ],
            'imageUpload' => [
                'maxSize' => UploadModelAvatar::maxSizeForHumans((int) config('uploads.max_size.avatar')),
                'types' => array_values(config('uploads.image_types')),
            ],
            'gitlab' => fn () => $canUpdate ? $this->gitlabSettings($team) : null,
            'figmaConnections' => fn () => $canUpdate
                ? $team->figmaConnections()->orderBy('name')->get()
                : null,
            'bots' => fn () => $canUpdate
                ? $team->bots()
                    ->whereNull('deactivated_at')
                    ->with(['tokens' => fn ($query) => $query->orderBy('created_at', 'desc')])
                    ->orderBy('name')
                    ->get()
                : null,
        ]);
    }

    public function uploadImage(Request $request, Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        return UploadModelAvatar::run($request, $team);
    }

    public function deleteImage(Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        return DeleteModelAvatar::run($team);
    }

    /**
     * GitLab connections and linked projects for the Integrations tab.
     *
     * @return array<string, mixed>
     */
    private function gitlabSettings(Team $team): array
    {
        $connections = $team->gitlabConnections()->orderBy('name')->get();

        return [
            'projects' => $team->gitlabProjects()->with('connection')->orderBy('name')->get(),
            'connections' => $connections,
            'activeConnections' => $connections
                ->where('is_active', true)
                ->values()
                ->map->only(['id', 'name', 'base_url']),
        ];
    }

    /**
     * Set `last_activity_at` on each board: the latest of the board's own
     * update, any task update, and any task activity (comments, moves, …).
     *
     * @param  Collection<int, Board>  $boards
     */
    private function attachLastActivity(Collection $boards): void
    {
        if ($boards->isEmpty()) {
            return;
        }

        $latestActivity = Activity::query()
            ->join('tasks', 'activities.task_id', '=', 'tasks.id')
            ->whereIn('tasks.board_id', $boards->modelKeys())
            ->groupBy('tasks.board_id')
            ->selectRaw('tasks.board_id as board_id, max(activities.created_at) as last_at')
            ->pluck('last_at', 'board_id');

        $boards->each(function (Board $board) use ($latestActivity) {
            $latest = collect([
                $board->updated_at,
                $board->tasks_max_updated_at,
                $latestActivity->get($board->id),
            ])
                ->filter()
                ->map(fn ($value) => Carbon::parse($value))
                ->max();

            $board->setAttribute('last_activity_at', $latest?->toIso8601String());
            $board->makeHidden('tasks_max_updated_at');
        });
    }
}
