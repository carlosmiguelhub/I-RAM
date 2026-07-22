<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
</head>
<body style="margin:0;padding:0;background:#F4F0E8;color:#2D332F;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F0E8;padding:32px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FFFFFF;border:1px solid #DED5C5;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(56,45,32,.10);">
                <tr>
                    <td style="height:6px;background:linear-gradient(90deg,#075A3A 0%,#D9961A 50%,#6B0F2B 100%);"></td>
                </tr>
                <tr>
                    <td style="padding:28px 32px;background:#075A3A;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td>
                                    <div style="font-size:22px;line-height:28px;font-weight:800;color:#FFFFFF;letter-spacing:.4px;">IRAM</div>
                                    <div style="margin-top:4px;font-size:11px;line-height:16px;font-weight:700;color:#F4C25E;text-transform:uppercase;letter-spacing:1.5px;">Records Management Notification</div>
                                </td>
                                <td align="right" style="font-size:12px;color:#E5DDCC;">{{ now()->format('M d, Y') }}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:32px;">
                        <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:{{ $softColor }};color:{{ $accentColor }};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;">{{ $typeLabel }}</div>
                        <h1 style="margin:18px 0 10px;font-size:25px;line-height:32px;color:#252A27;">{{ $title }}</h1>
                        <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:#514D46;">Hello {{ $recipientName }},</p>
                        <p style="margin:0;font-size:15px;line-height:24px;color:#625E56;">{{ $messageText }}</p>

                        @if (!empty($details))
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #E3DCCE;border-radius:14px;background:#FCFAF5;overflow:hidden;">
                                @foreach ($details as $label => $value)
                                    <tr>
                                        <td style="width:135px;padding:11px 14px;border-bottom:1px solid #EEE8DD;color:#766F63;font-size:12px;font-weight:700;vertical-align:top;">{{ $label }}</td>
                                        <td style="padding:11px 14px;border-bottom:1px solid #EEE8DD;color:#2D332F;font-size:13px;line-height:20px;word-break:break-word;">{{ $value }}</td>
                                    </tr>
                                @endforeach
                            </table>
                        @endif

                        @if (!empty($actor))
                            <p style="margin:20px 0 0;font-size:12px;line-height:19px;color:#928875;">
                                Updated by <strong style="color:#625E56;">{{ $actor['name'] ?? 'IRAM user' }}</strong>@if (!empty($actor['role'])) · {{ $actor['role'] }}@endif
                            </p>
                        @endif

                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;">
                            <tr>
                                <td style="border-radius:11px;background:#6B0F2B;">
                                    <a href="{{ $actionUrl }}" style="display:inline-block;padding:13px 22px;color:#FFFFFF;font-size:13px;font-weight:800;text-decoration:none;">{{ $actionLabel }} →</a>
                                </td>
                            </tr>
                        </table>

                        <div style="margin-top:28px;padding:16px;border-left:4px solid #D9961A;background:#FFF9EA;border-radius:0 10px 10px 0;">
                            <p style="margin:0;font-size:12px;line-height:19px;color:#766F63;">This is an automated IRAM workflow notification. Sign in through the official IRAM system before viewing or downloading institutional records.</p>
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:20px 32px;background:#17231E;text-align:center;">
                        <p style="margin:0;font-size:11px;line-height:18px;color:#CFC7B8;">Integrated Records and Archive Management System</p>
                        <p style="margin:3px 0 0;font-size:10px;line-height:16px;color:#928875;">Please do not reply to this automated message.</p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
