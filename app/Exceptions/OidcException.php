<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * An OIDC login or configuration failure.
 *
 * The message is safe to show to the user: it never contains tokens,
 * secrets or raw IdP responses. Extra diagnostic context for the log goes
 * in $context, which must follow the same rule.
 */
class OidcException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly array $context = [],
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
