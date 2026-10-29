<?php

namespace App\Mcp\Tools;

use App\Actions\Tasks\AddTaskDependency;
use App\Mcp\Support\Presenter;
use App\Mcp\Tools\Concerns\ManagesDependencies;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('add_dependency')]
#[Description('Record that `task` depends on (is blocked by) `depends_on`. Both tasks must be in the same team; duplicates and circular dependencies are rejected. Requires a token with the "write" ability.')]
class AddDependency extends PulseBoardTool
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

        AddTaskDependency::run($task, $dependsOn, $user);

        return $this->json([
            'added' => true,
            'task' => Presenter::relatedTask($task),
            'depends_on' => Presenter::relatedTask($dependsOn),
        ]);
    }
}
