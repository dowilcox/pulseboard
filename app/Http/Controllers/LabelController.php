<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLabelRequest;
use App\Models\Label;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

class LabelController extends Controller
{
    public function index(Team $team): JsonResponse
    {
        return response()->json($team->labels()->orderBy('name')->get());
    }

    public function store(StoreLabelRequest $request, Team $team): JsonResponse
    {
        $label = $team->labels()->create($request->validated());

        return response()->json($label, 201);
    }

    public function update(Request $request, Team $team, Label $label): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:50'],
            'color' => ['sometimes', 'string', 'max:7'],
        ]);

        $label->update($validated);

        return Redirect::back();
    }

    public function destroy(Team $team, Label $label): RedirectResponse
    {
        $label->delete();

        return Redirect::back();
    }
}
