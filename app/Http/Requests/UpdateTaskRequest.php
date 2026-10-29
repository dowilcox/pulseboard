<?php

namespace App\Http\Requests;

use App\Support\Recurrence;
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
            'description' => ['nullable', 'string', 'max:50000'],
            'priority' => [
                'sometimes',
                Rule::in(['urgent', 'high', 'medium', 'low', 'none']),
            ],
            'due_date' => ['nullable', 'date'],
            'effort_estimate' => ['nullable', 'integer', 'min:0'],
            // Partial update keyed by field definition id; values are
            // validated per field definition in UpdateTask.
            'custom_fields' => ['nullable', 'array', 'max:100'],
            'links' => ['nullable', 'array', 'max:50'],
            'links.*.id' => ['required', 'string'],
            'links.*.url' => ['required', 'url', 'max:2048'],
            'links.*.label' => ['required', 'string', 'max:255'],
            'checklists' => ['nullable', 'array', 'max:50'],
            'checklists.*.id' => ['required', 'string'],
            'checklists.*.title' => ['required', 'string', 'max:255'],
            'checklists.*.items' => ['nullable', 'array'],
            'checklists.*.items.*.id' => ['required', 'string'],
            'checklists.*.items.*.text' => ['required', 'string', 'max:1000'],
            'checklists.*.items.*.completed' => ['required', 'boolean'],
            'recurrence_config' => ['nullable', 'array'],
            'recurrence_config.frequency' => [
                'required_with:recurrence_config',
                Rule::in(Recurrence::FREQUENCIES),
            ],
            'recurrence_config.interval' => [
                'required_with:recurrence_config',
                'integer',
                'min:1',
                'max:365',
            ],
            'recurrence_config.days_of_week' => ['nullable', 'array', 'max:7'],
            'recurrence_config.days_of_week.*' => ['integer', 'between:0,6', 'distinct'],
            'recurrence_config.day_of_month' => ['nullable', 'integer', 'between:1,31'],
            'recurrence_config.end_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
