<x-mail::message>
# Hello {{ $user->name }},

You have **{{ $notifications->count() }}** new notification{{ $notifications->count() !== 1 ? 's' : '' }} on PulseBoard.

<x-mail::table>
| | Notification |
|---|---|
@foreach ($notifications as $notification)
| {{ \Carbon\Carbon::parse($notification->created_at)->format('M j, g:ia') }} | {{ $notification->data['message'] ?? 'New notification' }} |
@endforeach
</x-mail::table>

<x-mail::button :url="$appUrl">
View PulseBoard
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
