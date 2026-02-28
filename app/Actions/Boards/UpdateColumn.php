<?php

namespace App\Actions\Boards;

use App\Models\Column;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateColumn
{
    use AsAction;

    /**
     * Update the given column's properties.
     *
     * @param  array{name?: string, color?: string, wip_limit?: int|null, is_done_column?: bool}  $data
     */
    public function handle(Column $column, array $data): Column
    {
        $column->update($data);

        return $column->refresh();
    }
}
