<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBoardRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'settings' => ['sometimes', 'array'],
            'settings.auto_move_to_done' => ['sometimes', 'boolean'],
            'default_task_template_id' => [
                'sometimes',
                'nullable',
                'uuid',
                Rule::exists('task_templates', 'id')->where(
                    fn ($query) => $query->where('team_id', $this->route('team')?->id),
                ),
            ],
        ];
    }
}
