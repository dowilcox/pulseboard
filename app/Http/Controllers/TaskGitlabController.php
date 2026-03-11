<?php

namespace App\Http\Controllers;

use App\Actions\Gitlab\CreateBranchFromTask;
use App\Actions\Gitlab\CreateMergeRequestFromTask;
use App\Exceptions\GitlabApiException;
use App\Models\Board;
use App\Models\Task;
use App\Models\TaskGitlabRef;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TaskGitlabController extends Controller
{
    public function setProject(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'gitlab_project_id' => ['nullable', 'exists:gitlab_projects,id'],
        ]);

        $projectId = $validated['gitlab_project_id'];

        if ($projectId) {
            $taskTeam = $task->board->team;
            $taskTeam->gitlabProjects()->where('gitlab_projects.id', $projectId)->firstOrFail();
        }

        $task->update(['gitlab_project_id' => $projectId]);
        $task->load('gitlabProject.connection');

        return response()->json([
            'gitlab_project_id' => $task->gitlab_project_id,
            'gitlab_project' => $task->gitlabProject,
        ]);
    }

    public function index(Team $team, Board $board, Task $task): JsonResponse
    {
        $refs = $task->gitlabRefs()
            ->orderByDesc('created_at')
            ->get();

        return response()->json($refs);
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

            return response()->json($ref, 201);
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

            return response()->json($ref, 201);
        } catch (GitlabApiException $e) {
            Log::error('GitLab merge request creation failed', [
                'task_id' => $task->id,
                'project_id' => $gitlabProject->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function destroy(Team $team, Board $board, Task $task, TaskGitlabRef $ref): JsonResponse
    {
        $this->authorize('update', $task);

        $ref->delete();

        return response()->json(['message' => 'Ref removed']);
    }
}
