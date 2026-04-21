<?php

namespace App\Listeners;

use App\Events\TaskActivityLogged;
use App\Services\TaskAutomationDispatcher;

class RunTaskActivityAutomations
{
    public function __construct(
        private readonly TaskAutomationDispatcher $automationDispatcher,
    ) {}

    public function handle(TaskActivityLogged $event): void
    {
        $this->automationDispatcher->dispatch(
            $event->task,
            $event->action,
            $event->changes,
        );
    }
}
