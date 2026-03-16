<x-mail::message>
# Hello {{ $user->name }},

{{ $message }}

<x-mail::button :url="$actionUrl">
View Task
</x-mail::button>
</x-mail::message>
