<?php

namespace App\Exceptions;

use Exception;

class GitlabApiException extends Exception
{
    public function __construct(
        string $message,
        protected int $statusCode = 0,
        protected array $responseBody = [],
        ?Exception $previous = null,
    ) {
        parent::__construct($message, $statusCode, $previous);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getResponseBody(): array
    {
        return $this->responseBody;
    }

    public static function fromResponse(int $statusCode, array $body, string $context = ''): self
    {
        $message = $body['message'] ?? $body['error'] ?? 'Unknown GitLab API error';

        if ($context) {
            $message = "{$context}: {$message}";
        }

        return new self($message, $statusCode, $body);
    }
}
