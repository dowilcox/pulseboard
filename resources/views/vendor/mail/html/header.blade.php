@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
<img src="{{ config('app.url') }}/favicon.svg" class="logo" alt="{{ config('app.name') }} Logo" style="height: 48px; width: 48px; max-height: 48px;">
<span style="display: block; margin-top: 4px;">{{ config('app.name') }}</span>
</a>
</td>
</tr>
