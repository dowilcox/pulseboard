<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Enable the MCP Server
    |--------------------------------------------------------------------------
    |
    | When enabled, PulseBoard exposes a Model Context Protocol server over
    | streamable HTTP at /mcp so AI agents (Claude Code, Claude Desktop, ...)
    | can read and work boards. Requests authenticate with the same Sanctum
    | personal access tokens as the REST API. See docs/mcp-server.md.
    |
    | Routes are registered at boot, so under Octane a change requires a
    | worker reload (php artisan octane:reload).
    |
    */
    'enabled' => (bool) env('MCP_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Rate Limit
    |--------------------------------------------------------------------------
    |
    | Maximum MCP requests per minute per user. Agents tend to make bursts
    | of small calls, so this is separate from (and higher than) the REST
    | API limit.
    |
    */
    'rate_limit' => (int) env('MCP_RATE_LIMIT', 120),

    /*
    |--------------------------------------------------------------------------
    | List Limits
    |--------------------------------------------------------------------------
    |
    | Default and maximum number of items returned by list tools.
    |
    */
    'default_limit' => 50,

    'max_limit' => 200,
];
