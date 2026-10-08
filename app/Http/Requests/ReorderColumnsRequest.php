<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ReorderColumnsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'columns' => ['required', 'array', 'min:1'],
            'columns.*.id' => ['nullable', 'uuid'],
            'columns.*.name' => ['required', 'string', 'max:255'],
            'columns.*.color' => ['required', 'string', 'max:7'],
            'columns.*.wip_limit' => ['nullable', 'integer', 'min:0'],
            'columns.*.is_done_column' => ['boolean'],
            'columns.*.sort_order' => ['required', 'integer', 'min:0'],
            'columns.*._destroy' => ['boolean'],
            // Only meaningful alongside _destroy: where the removed column's
            // tasks should go. Board scoping is validated by ReorderColumns.
            'columns.*.move_tasks_to' => ['nullable', 'uuid'],
            // Only meaningful alongside _destroy: an explicit false means the
            // client expects the column to be empty and must not lose tasks.
            'columns.*.delete_tasks' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Readable names for wildcard fields ("column name", not "columns.2.name").
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'columns.*.name' => 'column name',
            'columns.*.color' => 'column color',
            'columns.*.wip_limit' => 'WIP limit',
            'columns.*.move_tasks_to' => 'target column',
        ];
    }
}
