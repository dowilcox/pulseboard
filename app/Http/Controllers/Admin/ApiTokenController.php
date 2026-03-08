<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ApiTokenController extends Controller
{
    public function index(Request $request): Response
    {
        $users = User::whereHas('tokens')
            ->orWhere('is_bot', true)
            ->with([
                'tokens' => fn ($q) => $q->orderBy('created_at', 'desc'),
                'createdByTeam:id,name',
            ])
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/ApiTokens', [
            'users' => $users,
        ]);
    }

    public function createToken(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['sometimes', 'array'],
            'abilities.*' => [Rule::in(['read', 'write'])],
        ]);

        $abilities = $validated['abilities'] ?? ['read'];
        $token = $user->createToken($validated['name'], $abilities);

        return back()->with('success', 'Token created: '.$token->plainTextToken);
    }

    public function revokeToken(Request $request, User $user, int $tokenId)
    {
        $user->tokens()->where('id', $tokenId)->delete();

        return back()->with('success', 'Token revoked.');
    }
}
