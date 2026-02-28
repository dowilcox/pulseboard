<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => session('status'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return Redirect::route('profile.edit');
    }

    /**
     * Update the user's notification preferences.
     */
    public function updateNotifications(Request $request): RedirectResponse
    {
        $validTypes = ['task_assigned', 'task_commented', 'task_mentioned', 'task_due_soon', 'task_overdue'];
        $validChannels = ['in_app', 'email'];

        $prefs = $request->validate([
            'prefs' => ['required', 'array'],
            'prefs.*' => ['array'],
            'prefs.*.in_app' => ['boolean'],
            'prefs.*.email' => ['boolean'],
        ]);

        // Filter to only valid types and channels
        $filtered = [];
        foreach ($prefs['prefs'] as $type => $channels) {
            if (in_array($type, $validTypes)) {
                $filtered[$type] = array_intersect_key($channels, array_flip($validChannels));
            }
        }

        $request->user()->update([
            'email_notification_prefs' => $filtered,
        ]);

        return Redirect::route('profile.edit');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
