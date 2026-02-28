<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['sometimes', Rule::in(['urgent', 'high', 'medium', 'low', 'none'])],
            'due_date' => ['nullable', 'date'],
            'effort_estimate' => ['nullable', 'integer', 'min:0'],
            'custom_fields' => ['nullable', 'array'],
        ];
    }
}
