<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(): Response
    {
        $organization = Organization::first();

        return Inertia::render('Admin/Settings', [
            'organization' => $organization,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'alpha_dash'],
        ]);

        $organization = Organization::first();

        if ($organization) {
            $organization->update($validated);
        } else {
            Organization::create(array_merge($validated, [
                'settings' => [],
            ]));
        }

        return Redirect::route('admin.settings.index');
    }
}
