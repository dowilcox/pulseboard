<?php

namespace App\Actions\Figma;

use App\Models\FigmaConnection;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteFigmaConnection
{
    use AsAction;

    public function handle(FigmaConnection $connection): void
    {
        $connection->delete();
    }
}
