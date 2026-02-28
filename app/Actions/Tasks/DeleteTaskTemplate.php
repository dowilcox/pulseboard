<?php

namespace App\Actions\Tasks;

use App\Models\TaskTemplate;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteTaskTemplate
{
    use AsAction;

    public function handle(TaskTemplate $template): void
    {
        $template->delete();
    }
}
