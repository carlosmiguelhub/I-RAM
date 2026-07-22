<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\InAppNotification;
use App\Notifications\WorkflowEmailNotification;
use Illuminate\Support\Facades\Notification;
use Throwable;

class InAppNotificationService
{
    public function notifyManagers(
        User $actor,
        string $title,
        string $message,
        string $type,
        string $url,
        array $context = []
    ): void {
        $recipients = User::query()
            ->where('status', 'active')
            ->whereNotNull('email_verified_at')
            ->whereKeyNot($actor->id)
            ->whereHas(
                'role',
                fn ($query) => $query->whereIn(
                    'name',
                    ['Admin', 'Records Officer']
                )
            )
            ->get();

        if ($recipients->isEmpty()) {
            return;
        }

        $payload = $this->payload(
            $actor,
            $title,
            $message,
            $type,
            $url,
            $context
        );

        Notification::send(
            $recipients,
            new InAppNotification($payload)
        );

        $this->sendEmail($recipients, $payload);
    }

    public function notifyUser(
        ?User $recipient,
        User $actor,
        string $title,
        string $message,
        string $type,
        string $url,
        array $context = []
    ): void {
        if (
            ! $recipient
            || $recipient->status !== 'active'
            || ! $recipient->hasVerifiedEmail()
            || $recipient->is($actor)
        ) {
            return;
        }

        $payload = $this->payload(
            $actor,
            $title,
            $message,
            $type,
            $url,
            $context
        );

        $recipient->notify(new InAppNotification($payload));
        $this->sendEmail([$recipient], $payload);
    }

    private function payload(
        User $actor,
        string $title,
        string $message,
        string $type,
        string $url,
        array $context
    ): array {
        return [
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'url' => $url,
            'actor' => [
                'id' => $actor->id,
                'name' => $actor->name,
                'role' => $actor->role?->name,
            ],
            ...$context,
        ];
    }

    private function sendEmail(iterable $recipients, array $payload): void
    {
        try {
            Notification::send(
                $recipients,
                new WorkflowEmailNotification($payload)
            );
        } catch (Throwable $exception) {
            // Workflow actions must still succeed if the mail provider is
            // temporarily unavailable. The exception remains visible in logs.
            report($exception);
        }
    }
}
