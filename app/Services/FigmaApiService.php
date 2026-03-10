<?php

namespace App\Services;

use App\Exceptions\FigmaApiException;
use App\Models\FigmaConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class FigmaApiService
{
    protected PendingRequest $http;

    public function __construct(protected FigmaConnection $connection)
    {
        $this->http = Http::withHeaders([
            "X-Figma-Token" => $connection->api_token,
        ])
            ->baseUrl(config("figma.api_base_url", "https://api.figma.com"))
            ->acceptJson()
            ->retry(3, 500, throw: false);
    }

    public static function for(FigmaConnection $connection): self
    {
        return new self($connection);
    }

    public function testConnection(): array
    {
        $response = $this->http->get("/v1/me");

        return $this->handleResponse($response, "Test connection");
    }

    public function getFileMetadata(string $fileKey): array
    {
        $response = $this->http->get("/v1/files/{$fileKey}/meta");

        $data = $this->handleResponse($response, "Get file metadata");

        return $data["file"] ?? $data;
    }

    /**
     * Get rendered image URLs for specific nodes.
     *
     * @return array<string, string|null> Map of node IDs to image URLs
     */
    public function getNodeImages(
        string $fileKey,
        array $nodeIds,
        string $format = "png",
        int $scale = 2,
    ): array {
        $response = $this->http->get("/v1/images/{$fileKey}", [
            "ids" => implode(",", $nodeIds),
            "format" => $format,
            "scale" => $scale,
        ]);

        $data = $this->handleResponse($response, "Get node images");

        return $data["images"] ?? [];
    }

    /**
     * Get metadata for specific nodes in a file.
     *
     * @return array<string, array> Map of node IDs to node data
     */
    public function getFileNodes(
        string $fileKey,
        array $nodeIds,
        int $depth = 0,
    ): array {
        $response = $this->http->get("/v1/files/{$fileKey}/nodes", [
            "ids" => implode(",", $nodeIds),
            "depth" => $depth,
        ]);

        $data = $this->handleResponse($response, "Get file nodes");

        return $data["nodes"] ?? [];
    }

    protected function handleResponse(
        Response $response,
        string $context = "",
    ): array {
        if ($response->successful()) {
            return $response->json() ?? [];
        }

        throw FigmaApiException::fromResponse(
            $response->status(),
            $response->json() ?? [],
            $context,
        );
    }
}
