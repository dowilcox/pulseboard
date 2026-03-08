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
        $users = User::where(function ($q) {
            $q->whereHas('tokens')
                ->orWhere('is_bot', true);
        })
            ->whereNull('deactivated_at')
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
        abort_if($user->deactivated_at, 403, 'Cannot create tokens for a deactivated user.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['sometimes', 'array'],
            'abilities.*' => [Rule::in(['read', 'write'])],
        ]);

        $abilities = $validated['abilities'] ?? ['read'];
        $token = $user->createToken($validated['name'], $abilities);

        return back()->with('success', 'Token created successfully. Copy it now — it won\'t be shown again.')
            ->with('token', $token->plainTextToken);
    }

    public function revokeToken(Request $request, User $user, int $tokenId)
    {
        $user->tokens()->where('id', $tokenId)->delete();

        return back()->with('success', 'Token revoked.');
    }
}
