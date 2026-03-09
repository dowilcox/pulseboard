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
            'sort_order' => ['required', 'numeric', 'min:0'],
        ];
    }
}
