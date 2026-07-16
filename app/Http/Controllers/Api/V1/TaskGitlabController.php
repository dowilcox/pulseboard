<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Gitlab\CreateBranchFromTask;
use App\Actions\Gitlab\CreateMergeRequestFromTask;
use App\Exceptions\GitlabApiException;
use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Task;
use App\Models\TaskGitlabRef;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class TaskGitlabController extends Controller
{
    public function index(Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('view', $task);

        $refs = $task->gitlabRefs()
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $refs]);
    }

    public function setProject(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'gitlab_project_id' => ['nullable', 'exists:gitlab_projects,id'],
        ]);

        $projectId = $validated['gitlab_project_id'] ?? null;

        if ($projectId) {
            // The project must belong to the task's team (404 otherwise).
            $taskTeam = $task->board->team;
            $taskTeam->gitlabProjects()->where('gitlab_projects.id', $projectId)->firstOrFail();
        }

        $task->update(['gitlab_project_id' => $projectId]);
        $task->load('gitlabProject.connection');

        return response()->json([
            'data' => [
                'gitlab_project_id' => $task->gitlab_project_id,
                'gitlab_project' => $task->gitlabProject,
            ],
        ]);
    }

    public function createBranch(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $gitlabProject = $task->gitlabProject;
        if (! $gitlabProject) {
            return response()->json(['error' => 'No GitLab project set for this task'], 422);
        }

        try {
            $ref = CreateBranchFromTask::run($task, $gitlabProject);

            return response()->json(['data' => $ref], 201);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 409);
        } catch (GitlabApiException $e) {
            Log::error('GitLab branch creation failed', [
                'task_id' => $task->id,
                'project_id' => $gitlabProject->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function createMergeRequest(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'source_branch' => ['nullable', 'string'],
        ]);

        $gitlabProject = $task->gitlabProject;
        if (! $gitlabProject) {
            return response()->json(['error' => 'No GitLab project set for this task'], 422);
        }

        try {
            $ref = CreateMergeRequestFromTask::run(
                $task,
                $gitlabProject,
                $validated['source_branch'] ?? null,
            );

            return response()->json(['data' => $ref], 201);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 409);
        } catch (GitlabApiException $e) {
            Log::error('GitLab merge request creation failed', [
                'task_id' => $task->id,
                'project_id' => $gitlabProject->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function destroyRef(Team $team, Board $board, Task $task, TaskGitlabRef $ref): JsonResponse
    {
        $this->authorize('update', $task);

        $ref->delete();

        return response()->json(null, 204);
    }
}
