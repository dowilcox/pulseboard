<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\PersonalAccessToken;

class TokenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tokens = $request->user()->tokens()
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'abilities' => $token->abilities,
                'last_used_at' => $token->last_used_at,
                'created_at' => $token->created_at,
            ]);

        return response()->json(['data' => $tokens]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['sometimes', 'array'],
            'abilities.*' => [Rule::in(['read', 'write', 'manage'])],
        ]);

        $abilities = array_values(array_unique($validated['abilities'] ?? ['read']));

        abort_unless(
            $this->currentTokenCovers($request, $abilities),
            403,
            'A token can only create tokens with abilities it has itself.',
        );

        $token = $request->user()->createToken($validated['name'], $abilities);

        return response()->json([
            'data' => [
                'id' => $token->accessToken->id,
                'name' => $token->accessToken->name,
                'abilities' => $token->accessToken->abilities,
                'plain_text_token' => $token->plainTextToken,
            ],
        ], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $token = $request->user()->tokens()->findOrFail($id);

        // A token may always revoke itself. Revoking another token needs at
        // least that token's abilities, so a leaked read-only token can't
        // knock out the user's more powerful tokens.
        $current = $request->user()->currentAccessToken();
        $isSelf = $current instanceof PersonalAccessToken && $current->getKey() === $token->getKey();

        abort_unless(
            $isSelf || $this->currentTokenCovers($request, $token->abilities ?? []),
            403,
            'A token can only revoke itself or tokens whose abilities it has.',
        );

        $token->delete();

        return response()->json(null, 204);
    }

    /**
     * Whether the request's credentials hold every given ability.
     *
     * Requests authenticated with a personal access token are limited to
     * that token's abilities, so a token can't mint (or revoke) a token more
     * powerful than itself. Session requests (Sanctum's TransientToken) act
     * with the user's full authority and are unrestricted.
     *
     * @param  array<int, string>  $abilities
     */
    private function currentTokenCovers(Request $request, array $abilities): bool
    {
        $current = $request->user()->currentAccessToken();

        if (! $current instanceof PersonalAccessToken) {
            return true;
        }

        foreach ($abilities as $ability) {
            if (! $current->can($ability)) {
                return false;
            }
        }

        return true;
    }
}
