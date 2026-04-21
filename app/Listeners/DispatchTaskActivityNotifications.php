<?php

namespace App\Listeners;

use App\Events\TaskActivityLogged;
use App\Services\TaskActivityNotifier;

class DispatchTaskActivityNotifications
{
    public function __construct(
        private readonly TaskActivityNotifier $notifier,
    ) {}

    public function handle(TaskActivityLogged $event): void
    {
        $this->notifier->dispatchActivityNotifications(
            $event->task,
            $event->action,
            $event->changes,
            $event->actor,
        );
    }
}
