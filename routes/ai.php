<?php

use App\Mcp\Servers\PulseBoardServer;
use Laravel\Mcp\Facades\Mcp;

/*
 * MCP (Model Context Protocol) server for AI agents. Loaded by
 * laravel/mcp's service provider, which registers it before the web
 * routes, so "mcp" is also a reserved team slug (see UniqueSlug).
 *
 * Authenticates with Sanctum personal access tokens, like the v1 API.
 * Token abilities are enforced per tool (see App\Mcp\Tools\PulseBoardTool).
 */
if (config('mcp_server.enabled')) {
    Mcp::web('/mcp', PulseBoardServer::class)
        ->middleware(['auth:sanctum', 'ensure.active', 'throttle:mcp'])
        ->name('mcp');
}
