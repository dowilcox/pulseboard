<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()]);
    }

    public function tasks(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'status' => ['sometimes', 'string', 'in:open,completed,all'],
        ]);

        $perPage = $validated['per_page'] ?? 50;
        $status = $validated['status'] ?? 'open';

        $query = Task::whereHas('assignees', function ($q) use ($request) {
            $q->where('users.id', $request->user()->id);
        })->with(['assignees', 'labels', 'column:id,name,board_id', 'board:id,name,team_id']);

        if ($status === 'open') {
            $query->whereNull('completed_at');
        } elseif ($status === 'completed') {
            $query->whereNotNull('completed_at');
        }

        $query->orderBy('due_date', 'asc')->orderBy('created_at', 'desc');

        return response()->json($query->paginate($perPage));
    }
}
