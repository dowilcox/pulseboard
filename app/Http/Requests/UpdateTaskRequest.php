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
            'checklists' => ['nullable', 'array'],
            'checklists.*.id' => ['required', 'string'],
            'checklists.*.title' => ['required', 'string', 'max:255'],
            'checklists.*.items' => ['nullable', 'array'],
            'checklists.*.items.*.id' => ['required', 'string'],
            'checklists.*.items.*.text' => ['required', 'string', 'max:1000'],
            'checklists.*.items.*.completed' => ['required', 'boolean'],
            'recurrence_config' => ['nullable', 'array'],
            'recurrence_config.frequency' => ['required_with:recurrence_config', Rule::in(['daily', 'weekly', 'monthly', 'custom'])],
            'recurrence_config.interval' => ['required_with:recurrence_config', 'integer', 'min:1'],
        ];
    }
}
