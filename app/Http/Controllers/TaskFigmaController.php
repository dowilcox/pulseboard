<?php

namespace App\Http\Controllers;

use App\Actions\Figma\LinkFigmaFile;
use App\Exceptions\FigmaApiException;
use App\Models\Board;
use App\Models\Task;
use App\Models\TaskFigmaLink;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class TaskFigmaController extends Controller
{
    public function index(Team $team, Board $board, Task $task): JsonResponse
    {
        $links = $task
            ->figmaLinks()
            ->with('figmaConnection')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($links);
    }

    public function store(
        Request $request,
        Team $team,
        Board $board,
        Task $task,
    ): JsonResponse {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'figma_connection_id' => [
                'required',
                'exists:figma_connections,id',
            ],
            'url' => ['required', 'url', 'max:2048'],
        ]);

        $connection = $team
            ->figmaConnections()
            ->where('is_active', true)
            ->findOrFail($validated['figma_connection_id']);

        try {
            $link = LinkFigmaFile::run($task, $connection, $validated['url']);

            return response()->json($link->load('figmaConnection'), 201);
        } catch (FigmaApiException $e) {
            Log::warning('Figma file link failed', [
                'task_id' => $task->id,
                'url' => $validated['url'],
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => $e->getMessage()], 422);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function destroy(
        Team $team,
        Board $board,
        Task $task,
        TaskFigmaLink $link,
    ): JsonResponse {
        $this->authorize('update', $task);

        $link->delete();

        return response()->json(['message' => 'Link removed']);
    }
}
