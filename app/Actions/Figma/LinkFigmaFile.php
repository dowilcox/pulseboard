<?php

namespace App\Actions\Figma;

use App\Models\FigmaConnection;
use App\Models\Task;
use App\Models\TaskFigmaLink;
use App\Services\FigmaApiService;
use App\Services\FigmaUrlParser;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class LinkFigmaFile
{
    use AsAction;

    public function handle(
        Task $task,
        FigmaConnection $connection,
        string $url,
    ): TaskFigmaLink {
        $parsed = FigmaUrlParser::parse($url);

        if (! $parsed) {
            throw ValidationException::withMessages([
                'url' => ['The URL is not a valid Figma link.'],
            ]);
        }

        $api = FigmaApiService::for($connection);
        $fileMeta = $api->getFileMetadata($parsed['file_key']);
        $fileName = $fileMeta['name'] ?? 'Untitled';
        $thumbnailUrl = $fileMeta['thumbnail_url'] ?? null;
        $name = $fileName;
        $meta = ['file_name' => $fileName];

        // When a specific node is linked, fetch its metadata and rendered preview
        if ($parsed['node_id']) {
            try {
                // Fetch with depth=1 to get the node info and its direct children
                $nodes = $api->getFileNodes(
                    $parsed['file_key'],
                    [$parsed['node_id']],
                    1,
                );
                $nodeData = $nodes[$parsed['node_id']]['document'] ?? null;
                if ($nodeData) {
                    $name = $nodeData['name'] ?? $fileName;
                    $meta['node_type'] = $nodeData['type'] ?? null;

                    // For pages (CANVAS), collect child frame names
                    if (
                        ($nodeData['type'] ?? null) === 'CANVAS' &&
                        ! empty($nodeData['children'])
                    ) {
                        $meta['children'] = collect($nodeData['children'])
                            ->filter(
                                fn ($c) => in_array($c['type'] ?? '', [
                                    'FRAME',
                                    'COMPONENT',
                                    'COMPONENT_SET',
                                    'SECTION',
                                ]),
                            )
                            ->map(
                                fn ($c) => [
                                    'name' => $c['name'] ?? 'Untitled',
                                    'type' => $c['type'] ?? 'FRAME',
                                ],
                            )
                            ->values()
                            ->take(12)
                            ->all();
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('Figma node metadata fetch failed', [
                    'file_key' => $parsed['file_key'],
                    'node_id' => $parsed['node_id'],
                    'error' => $e->getMessage(),
                ]);
            }

            // For non-page nodes, render a preview image of the specific node
            $isPage = ($meta['node_type'] ?? null) === 'CANVAS';
            if (! $isPage) {
                try {
                    $images = $api->getNodeImages($parsed['file_key'], [
                        $parsed['node_id'],
                    ]);
                    if (! empty($images[$parsed['node_id']])) {
                        $thumbnailUrl = $images[$parsed['node_id']];
                    }
                } catch (\Throwable $e) {
                    Log::warning('Figma node image fetch failed', [
                        'file_key' => $parsed['file_key'],
                        'node_id' => $parsed['node_id'],
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        return TaskFigmaLink::create([
            'task_id' => $task->id,
            'figma_connection_id' => $connection->id,
            'file_key' => $parsed['file_key'],
            'node_id' => $parsed['node_id'],
            'name' => $name,
            'url' => $url,
            'thumbnail_url' => $thumbnailUrl,
            'last_modified_at' => $fileMeta['last_modified'] ?? null,
            'meta' => $meta,
            'last_synced_at' => now(),
        ]);
    }
}
