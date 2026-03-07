<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ApiTokenController extends Controller
{
    public function index(Request $request): Response
    {
        $users = User::whereHas('tokens')
            ->orWhere('is_bot', true)
            ->with(['tokens' => function ($q) {
                $q->orderBy('created_at', 'desc');
            }])
            ->orderBy('name')
            ->get();

        $botUsers = User::where('is_bot', true)->orderBy('name')->get();

        return Inertia::render('Admin/ApiTokens', [
            'users' => $users,
            'botUsers' => $botUsers,
        ]);
    }

    public function storeBot(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $email = Str::slug($validated['name']).'-'.Str::random(8).'@pulseboard.local';

        User::create([
            'name' => $validated['name'],
            'email' => $email,
            'password' => bcrypt(Str::random(64)),
            'is_bot' => true,
            'is_admin' => false,
            'auth_provider' => 'local',
        ]);

        return back()->with('success', 'Bot user created.');
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
