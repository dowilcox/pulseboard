<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class MakeUserAdmin extends Command
{
    protected $signature = 'user:make-admin {email : The email address of the user}';

    protected $description = 'Grant admin privileges to a user';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error("No user found with email: {$this->argument('email')}");

            return self::FAILURE;
        }

        if ($user->is_admin) {
            $this->info("{$user->name} is already an admin.");

            return self::SUCCESS;
        }

        $user->update(['is_admin' => true]);

        $this->info("Granted admin privileges to {$user->name} ({$user->email}).");

        return self::SUCCESS;
    }
}
