<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateBotUser
{
    use AsAction;

    public function handle(Team $team, array $data): User
    {
        $email = Str::slug($data['name']).'-'.Str::random(8).'@pulseboard.local';

        $user = User::create([
            'name' => $data['name'],
            'email' => $email,
            'password' => bcrypt(Str::random(64)),
            'is_bot' => true,
            'is_admin' => false,
            'auth_provider' => 'local',
            'created_by_team_id' => $team->id,
        ]);

        AddTeamMember::run($team, $user, 'member');

        return $user;
    }
}
