<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $teamId = $this->route('team')?->id;
        $boardId = $this->route('board')?->id;

        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['sometimes', Rule::in(['urgent', 'high', 'medium', 'low', 'none'])],
            'due_date' => ['nullable', 'date'],
            'effort_estimate' => ['nullable', 'integer', 'min:0'],
            'assignee_ids' => ['nullable', 'array', 'max:50'],
            'assignee_ids.*' => [
                'uuid',
                Rule::exists('team_members', 'user_id')->where(
                    fn ($query) => $query->where('team_id', $teamId),
                ),
            ],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => [
                'uuid',
                Rule::exists('labels', 'id')->where(
                    fn ($query) => $query->where('team_id', $teamId),
                ),
            ],
            'parent_task_id' => [
                'nullable',
                'uuid',
                Rule::exists('tasks', 'id')->where(
                    fn ($query) => $query->where('board_id', $boardId),
                ),
            ],
        ];
    }
}
