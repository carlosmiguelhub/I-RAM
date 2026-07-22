IRAM — Records Management Notification

{{ $typeLabel }}
{{ $title }}

Hello {{ $recipientName }},

{{ $messageText }}

@foreach ($details as $label => $value)
{{ $label }}: {{ $value }}
@endforeach

@if (!empty($actor))
Updated by: {{ $actor['name'] ?? 'IRAM user' }}@if (!empty($actor['role'])) ({{ $actor['role'] }})@endif
@endif

{{ $actionLabel }}: {{ $actionUrl }}

This is an automated IRAM workflow notification. Sign in through the official IRAM system before viewing or downloading institutional records.
