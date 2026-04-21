<?php

namespace App\Providers;

use App\Events\TaskActivityLogged;
use App\Listeners\BroadcastTaskActivity;
use App\Listeners\DispatchTaskActivityNotifications;
use App\Listeners\RunTaskActivityAutomations;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        TaskActivityLogged::class => [
            BroadcastTaskActivity::class,
            DispatchTaskActivityNotifications::class,
            RunTaskActivityAutomations::class,
        ],
    ];
}
