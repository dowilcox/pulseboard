<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Figma\LinkFigmaFile;
use App\Exceptions\FigmaApiException;
use App\Http\Controllers\Controller;
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
        $this->authorize('view', $task);

        $links = $task
            ->figmaLinks()
            ->with('figmaConnection')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $links]);
    }

    public function store(Request $request, Team $team, Board $board, Task $task): JsonResponse
    {
        $this->authorize('update', $task);

        $validated = $request->validate([
            'figma_connection_id' => ['required', 'exists:figma_connections,id'],
            'url' => ['required', 'url', 'max:2048'],
        ]);

        // The connection must be an active one belonging to this team (404 otherwise).
        $connection = $team
            ->figmaConnections()
            ->where('is_active', true)
            ->findOrFail($validated['figma_connection_id']);

        try {
            $link = LinkFigmaFile::run($task, $connection, $validated['url']);

            return response()->json(['data' => $link->load('figmaConnection')], 201);
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

    public function destroy(Team $team, Board $board, Task $task, TaskFigmaLink $link): JsonResponse
    {
        $this->authorize('update', $task);

        $link->delete();

        return response()->json(null, 204);
    }
}
