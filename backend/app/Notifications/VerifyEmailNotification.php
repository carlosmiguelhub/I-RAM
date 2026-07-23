<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends Notification
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            [
                'id' => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ],
            absolute: false
        );

        $query = [];
        parse_str((string) parse_url($verificationUrl, PHP_URL_QUERY), $query);

        $frontendUrl = rtrim((string) config('iram.frontend_url'), '/').'/verify-email?'.http_build_query([
            'id' => $notifiable->getKey(),
            'hash' => sha1($notifiable->getEmailForVerification()),
            'expires' => $query['expires'] ?? '',
            'signature' => $query['signature'] ?? '',
        ]);

        return (new MailMessage)
            ->subject('Verify your IRAM email address')
            ->greeting("Hello {$notifiable->name},")
            ->line('Please verify your email address to continue your IRAM account registration.')
            ->action('Verify Email Address', $frontendUrl)
            ->line('This verification link expires in 60 minutes.')
            ->line('After verification, an Administrator must activate your account before you can sign in.')
            ->line('If you did not create this account, no action is required.');
    }
}
