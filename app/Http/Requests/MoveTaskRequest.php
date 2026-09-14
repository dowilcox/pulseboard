<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MoveTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'board_id' => ['sometimes', 'nullable', 'uuid', 'exists:boards,id'],
            'column_id' => ['required', 'uuid', 'exists:columns,id'],
            // Negative values are valid: inserting above a task whose
            // sort_order is 0 yields -1 (see resources/js/utils/sortOrder.ts).
            // null appends the task after the column's last task.
            'sort_order' => ['present', 'nullable', 'numeric'],
        ];
    }
}
