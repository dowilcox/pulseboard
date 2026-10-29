<?php

namespace App\Http\Requests;

use App\Models\BoardCustomField;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', Rule::in(BoardCustomField::TYPES)],
            'show_on_card' => ['sometimes', 'boolean'],
            ...self::optionRules(required: true),
        ];
    }

    /**
     * Rules for a select / multi_select field's `options`; ignored for
     * other types.
     *
     * @return array<string, array<mixed>>
     */
    public static function optionRules(bool $required): array
    {
        return [
            'options' => [
                'exclude_unless:type,'.BoardCustomField::TYPE_SELECT.','.BoardCustomField::TYPE_MULTI_SELECT,
                $required ? 'required' : 'sometimes',
                'array',
                'min:1',
                'max:'.BoardCustomField::MAX_OPTIONS,
            ],
            'options.*' => ['array'],
            'options.*.id' => ['nullable', 'string', 'max:64'],
            'options.*.label' => ['required', 'string', 'max:100'],
            'options.*.color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'options.*.label' => 'option label',
            'options.*.color' => 'option color',
        ];
    }
}
