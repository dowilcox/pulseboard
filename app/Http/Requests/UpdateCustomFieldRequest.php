<?php

namespace App\Http\Requests;

use App\Models\BoardCustomField;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCustomFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The field's own type decides whether `options` apply, so clients may
     * omit `type`. Sending a different type is rejected by UpdateCustomField.
     */
    protected function prepareForValidation(): void
    {
        $field = $this->route('customField');

        if ($field instanceof BoardCustomField && ! $this->has('type')) {
            $this->merge(['type' => $field->type]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'type' => ['sometimes', 'string'],
            'show_on_card' => ['sometimes', 'boolean'],
            ...StoreCustomFieldRequest::optionRules(required: false),
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
