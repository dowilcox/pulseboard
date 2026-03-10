<x-mail::message>
# Hello {{ $user->name }},

{{ $message }}

<x-mail::button :url="$actionUrl">
View Task
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
