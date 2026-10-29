<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\RemoveTaskDependency;
use App\Mcp\Exceptions\ToolException;
use App\Mcp\Support\Presenter;
use App\Mcp\Tools\Concerns\ManagesDependencies;
use App\Models\TaskDependency;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('remove_dependency')]
#[Description('Remove the dependency "`task` depends on `depends_on`". Requires a token with the "write" ability.')]
class RemoveDependency extends PulseBoardTool
{
    use ManagesDependencies;

    protected ?string $ability = 'write';

    public function schema(JsonSchema $schema): array
    {
        return $this->dependencySchema($schema);
    }

    protected function run(Request $request, User $user): Response
    {
        [$task, $dependsOn] = $this->resolveDependencyPair($request, $user);

        $exists = TaskDependency::query()
            ->where('task_id', $task->id)
            ->where('depends_on_task_id', $dependsOn->id)
            ->exists();

        if (! $exists) {
            throw new ToolException('No such dependency: '.Presenter::taskRef($task).' does not depend on '.Presenter::taskRef($dependsOn).'.');
        }

        RemoveTaskDependency::run($task, $dependsOn, $user);

        return $this->json([
            'removed' => true,
            'task' => Presenter::relatedTask($task),
            'depends_on' => Presenter::relatedTask($dependsOn),
        ]);
    }
}
