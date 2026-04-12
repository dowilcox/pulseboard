<?php

namespace App\Http\Controllers;

use App\Actions\Teams\CreateTeam;
use App\Actions\Teams\DeleteTeam;
use App\Actions\Teams\UpdateTeam;
use App\Http\Requests\ConfirmDeleteRequest;
use App\Http\Requests\StoreTeamRequest;
use App\Http\Requests\UpdateTeamRequest;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileCannotBeAdded;
use Spatie\MediaLibrary\MediaCollections\Exceptions\FileIsTooBig;

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
            ->withCount(['members', 'boards'])
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
    public function show(Team $team): Response
    {
        $this->authorize('view', $team);

        $team->load(['media', 'members' => function ($query) {
            $query->whereNull('deactivated_at');
        }, 'boards' => function ($query) {
            $query->active()->with(['columns', 'media'])->orderBy('sort_order');
        }]);

        return Inertia::render('Teams/Show', [
            'team' => $team,
            'members' => $team->members,
            'boards' => $team->boards,
        ]);
    }

    /**
     * Update the specified team.
     */
    public function update(UpdateTeamRequest $request, Team $team): RedirectResponse
    {
        $this->authorize('update', $team);

        UpdateTeam::run($team, $request->validated());

        return Redirect::route('teams.show', $team);
    }

    /**
     * Delete the specified team.
     */
    public function destroy(ConfirmDeleteRequest $request, Team $team): RedirectResponse
    {
        $this->authorize('delete', $team);

        DeleteTeam::run($team);

        return Redirect::route('teams.index');
    }

    /**
     * Display team settings.
     */
    public function settings(Team $team): Response
    {
        $this->authorize('view', $team);

        $sidebarBoards = $team->boards()
            ->active()
            ->select('id', 'team_id', 'name', 'slug', 'sort_order')
            ->with('media')
            ->orderBy('sort_order')
            ->get();
        $labels = $team->labels()->orderBy('name')->get();
        $activeMembers = $team->members()->whereNull('deactivated_at')->orderBy('name')->get();
        $deactivatedMembers = $team->members()->whereNotNull('deactivated_at')->orderBy('name')->get();
        $canManageMembers = auth()->user()->can('manageMember', $team);
        $canManageAdmins = auth()->user()->can('manageAdmin', $team);

        return Inertia::render('Teams/Settings', [
            'team' => $team,
            'sidebarBoards' => $sidebarBoards,
            'labels' => $labels,
            'members' => $activeMembers,
            'deactivatedMembers' => $deactivatedMembers,
            'canManageMembers' => $canManageMembers,
            'canManageAdmins' => $canManageAdmins,
        ]);
    }

    public function uploadImage(Request $request, Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        $maxSize = config('uploads.max_size.avatar');
        $allowedTypes = implode(',', config('uploads.image_types'));

        $request->validate([
            'image' => ['required', 'image', "max:{$maxSize}", "mimes:{$allowedTypes}"],
        ]);

        try {
            $team->addMedia($request->file('image'))
                ->toMediaCollection('avatar');
        } catch (FileIsTooBig) {
            return response()->json(['message' => 'The image is too large. Maximum size is 2MB.'], 422);
        } catch (FileCannotBeAdded $e) {
            return response()->json(['message' => 'The image could not be uploaded: '.$e->getMessage()], 422);
        }

        return response()->json([
            'image_url' => $team->getFirstMediaUrl('avatar', 'avatar'),
        ]);
    }

    public function deleteImage(Team $team): JsonResponse
    {
        $this->authorize('update', $team);

        $team->clearMediaCollection('avatar');

        return response()->json(['message' => 'Image removed']);
    }
}
