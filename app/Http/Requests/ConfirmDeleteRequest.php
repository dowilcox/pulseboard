<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ConfirmDeleteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization handled by controllers
    }

    public function rules(): array
    {
        return [
            'confirmation' => ['required', 'string', 'in:DELETE'],
        ];
    }

    public function messages(): array
    {
        return [
            'confirmation.in' => 'You must type DELETE to confirm.',
        ];
    }
}
