<?php

namespace App\Services;

use App\Exceptions\GitlabApiException;
use App\Models\GitlabConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class GitlabApiService
{
    protected PendingRequest $http;

    public function __construct(protected GitlabConnection $connection)
    {
        $this->http = Http::withToken($connection->api_token)
            ->baseUrl(rtrim($connection->base_url, '/').'/api/v4')
            ->acceptJson()
            ->retry(3, 500, throw: false);
    }

    public static function for(GitlabConnection $connection): self
    {
        return new self($connection);
    }

    public function testConnection(): array
    {
        $response = $this->http->get('/user');

        return $this->handleResponse($response, 'Test connection');
    }

    public function searchProjects(string $query): array
    {
        $response = $this->http->get('/projects', [
            'search' => $query,
            'membership' => true,
            'per_page' => 20,
            'order_by' => 'last_activity_at',
        ]);

        return $this->handleResponse($response, 'Search projects');
    }

    public function getProject(int $id): array
    {
        $response = $this->http->get("/projects/{$id}");

        return $this->handleResponse($response, 'Get project');
    }

    public function createBranch(int $projectId, string $name, string $ref): array
    {
        $response = $this->http->post("/projects/{$projectId}/repository/branches", [
            'branch' => $name,
            'ref' => $ref,
        ]);

        return $this->handleResponse($response, 'Create branch');
    }

    public function createMergeRequest(int $projectId, array $data): array
    {
        $response = $this->http->post("/projects/{$projectId}/merge_requests", $data);

        return $this->handleResponse($response, 'Create merge request');
    }

    public function getMergeRequest(int $projectId, int $iid): array
    {
        $response = $this->http->get("/projects/{$projectId}/merge_requests/{$iid}");

        return $this->handleResponse($response, 'Get merge request');
    }

    public function listMergeRequests(int $projectId, array $filters = []): array
    {
        $response = $this->http->get("/projects/{$projectId}/merge_requests", $filters);

        return $this->handleResponse($response, 'List merge requests');
    }

    public function getPipelineStatus(int $projectId, string $ref): array
    {
        $response = $this->http->get("/projects/{$projectId}/pipelines", [
            'ref' => $ref,
            'per_page' => 1,
            'order_by' => 'id',
            'sort' => 'desc',
        ]);

        $pipelines = $this->handleResponse($response, 'Get pipeline status');

        return $pipelines[0] ?? [];
    }

    public function registerWebhook(int $projectId, string $url, string $secret): array
    {
        $response = $this->http->post("/projects/{$projectId}/hooks", [
            'url' => $url,
            'token' => $secret,
            'merge_requests_events' => true,
            'pipeline_events' => true,
            'push_events' => true,
            'enable_ssl_verification' => true,
        ]);

        return $this->handleResponse($response, 'Register webhook');
    }

    public function deleteWebhook(int $projectId, int $hookId): void
    {
        $response = $this->http->delete("/projects/{$projectId}/hooks/{$hookId}");

        if ($response->failed() && $response->status() !== 404) {
            $this->handleResponse($response, 'Delete webhook');
        }
    }

    protected function handleResponse(Response $response, string $context = ''): array
    {
        if ($response->successful()) {
            return $response->json() ?? [];
        }

        throw GitlabApiException::fromResponse(
            $response->status(),
            $response->json() ?? [],
            $context,
        );
    }
}
