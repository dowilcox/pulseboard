<?php

namespace App\Events;

use App\Models\Activity;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TaskActivityLogged
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly Task $task,
        public readonly string $action,
        public readonly array $changes,
        public readonly ?User $actor,
        public readonly Activity $activity,
    ) {}
}
