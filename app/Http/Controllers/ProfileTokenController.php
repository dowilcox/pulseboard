<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;

/**
 * Self-service personal access tokens for the signed-in user, managed from
 * the profile page. Every query goes through `$request->user()->tokens()`,
 * so users can only ever see or revoke their own tokens.
 */
class ProfileTokenController extends Controller
{
    /**
     * List the user's tokens (JSON, loaded by the profile page via axios).
     */
    public function index(Request $request): JsonResponse
    {
        $tokens = $request->user()->tokens()
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'abilities' => $token->abilities,
                'last_used_at' => $token->last_used_at?->toIso8601String(),
                'created_at' => $token->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $tokens]);
    }

    /**
     * Create a token and flash its plaintext value once.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['sometimes', 'array'],
            'abilities.*' => [Rule::in(['read', 'write'])],
        ]);

        // Every token can read; write is opt-in on top of it.
        $abilities = in_array('write', $validated['abilities'] ?? [], true)
            ? ['read', 'write']
            : ['read'];

        $token = $request->user()->createToken($validated['name'], $abilities);

        return Redirect::back()
            ->with('success', 'API token created. Copy it now — it won\'t be shown again.')
            ->with('token', $token->plainTextToken);
    }

    /**
     * Revoke one of the user's own tokens.
     */
    public function destroy(Request $request, int $token): RedirectResponse
    {
        $request->user()->tokens()->whereKey($token)->firstOrFail()->delete();

        return Redirect::back()->with('success', 'API token revoked.');
    }
}
