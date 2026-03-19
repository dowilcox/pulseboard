<x-mail::message>

You have **{{ $notifications->count() }}** new notification{{ $notifications->count() !== 1 ? 's' : '' }}:

@foreach ($notifications as $notification)
- {{ $notification->data['message'] ?? 'New notification' }}
@endforeach

---

[View it on PulseBoard]({{ $appUrl }}).

<small>You're receiving this email because of your account on {{ $appDomain }}. [Manage all notifications]({{ $notificationSettingsUrl }})</small>

</x-mail::message>
