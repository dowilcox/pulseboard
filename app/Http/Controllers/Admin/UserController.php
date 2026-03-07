<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $query = User::query()->orderBy('name');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $perPage = in_array((int) $request->input('per_page'), [10, 25, 50]) ? (int) $request->input('per_page') : 25;

        return Inertia::render('Admin/Users', [
            'users' => $query->paginate($perPage)->withQueryString(),
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users'],
            'password' => ['required', Rules\Password::defaults()],
            'is_admin' => ['boolean'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'is_admin' => $validated['is_admin'] ?? false,
        ]);

        event(new Registered($user));

        return Redirect::route('admin.users.index')
            ->with('success', 'User created successfully.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        if ($user->is_bot) {
            return Redirect::route('admin.users.index')
                ->with('error', 'Bot users cannot be edited.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'is_admin' => ['boolean'],
        ]);

        $user->update($validated);

        return Redirect::route('admin.users.index')
            ->with('success', 'User updated successfully.');
    }

    public function toggleActive(User $user): RedirectResponse
    {
        if ($user->id === auth()->id()) {
            return Redirect::route('admin.users.index')
                ->with('error', 'You cannot deactivate your own account.');
        }

        if ($user->deactivated_at) {
            $user->update(['deactivated_at' => null]);
            $message = 'User reactivated successfully.';
        } else {
            $user->update(['deactivated_at' => now()]);
            $message = 'User deactivated successfully.';
        }

        return Redirect::route('admin.users.index')
            ->with('success', $message);
    }

    public function resetPassword(User $user): RedirectResponse
    {
        if ($user->is_bot) {
            return Redirect::route('admin.users.index')
                ->with('error', 'Bot users do not have passwords.');
        }

        Password::sendResetLink(['email' => $user->email]);

        return Redirect::route('admin.users.index')
            ->with('success', 'Password reset link sent.');
    }
}
