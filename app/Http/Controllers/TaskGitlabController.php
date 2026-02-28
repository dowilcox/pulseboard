<?php

namespace App\Http\Controllers;

use App\Actions\Gitlab\CreateBranchFromTask;
use App\Actions\Gitlab\CreateMergeRequestFromTask;
use App\Exceptions\GitlabApiException;
use App\Models\Board;
use App\Models\GitlabProject;
use App\Models\Task;
use App\Models\TaskGitlabLink;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskGitlabController extends Controller
{
    public function index(Team $team, Board $board, Task $task): JsonResponse
    {
        $links = $task->gitlabLinks()
            ->with('gitlabProject')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($links);
    }

    public function createBranch(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $validated = $request->validate([
            'gitlab_project_id' => ['required', 'exists:gitlab_projects,id'],
        ]);

        $gitlabProject = GitlabProject::findOrFail($validated['gitlab_project_id']);

        try {
            $link = CreateBranchFromTask::run($task, $gitlabProject);

            return response()->json($link->load('gitlabProject'), 201);
        } catch (GitlabApiException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function createMergeRequest(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $validated = $request->validate([
            'gitlab_project_id' => ['required', 'exists:gitlab_projects,id'],
            'source_branch' => ['nullable', 'string'],
        ]);

        $gitlabProject = GitlabProject::findOrFail($validated['gitlab_project_id']);

        try {
            $link = CreateMergeRequestFromTask::run(
                $task,
                $gitlabProject,
                $validated['source_branch'] ?? null,
            );

            return response()->json($link->load('gitlabProject'), 201);
        } catch (GitlabApiException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function destroy(Team $team, Board $board, Task $task, TaskGitlabLink $link): JsonResponse
    {
        $link->delete();

        return response()->json(['message' => 'Link removed']);
    }
}
