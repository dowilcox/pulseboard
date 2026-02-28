<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Webhook Route Prefix
    |--------------------------------------------------------------------------
    |
    | The URL prefix for GitLab webhook endpoints.
    |
    */
    'webhook_prefix' => 'api/webhooks/gitlab',

    /*
    |--------------------------------------------------------------------------
    | Auto-Link Pattern
    |--------------------------------------------------------------------------
    |
    | The regex pattern used to auto-link GitLab MRs/branches to tasks.
    | Captures the task number from merge request titles, descriptions,
    | and branch names.
    |
    */
    'auto_link_pattern' => '/PB-(\d+)/i',

    /*
    |--------------------------------------------------------------------------
    | Sync Interval
    |--------------------------------------------------------------------------
    |
    | How often (in minutes) to sync stale GitLab link data.
    |
    */
    'sync_interval' => 15,
];
