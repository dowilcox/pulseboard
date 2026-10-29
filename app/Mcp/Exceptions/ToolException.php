<?php

namespace App\Mcp\Exceptions;

use RuntimeException;

/**
 * A user-facing tool failure. The message is returned to the MCP client as
 * a tool error (isError: true), so it must be safe to show and should tell
 * the agent how to recover (e.g. which tool lists valid values).
 */
class ToolException extends RuntimeException
{
    //
}
