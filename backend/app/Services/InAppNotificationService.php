<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\InAppNotification;
use Illuminate\Support\Facades\Notification;

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

        Notification::send(
            $recipients,
            new InAppNotification($this->payload(
                $actor,
                $title,
                $message,
                $type,
                $url,
                $context
            ))
        );
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
            || $recipient->is($actor)
        ) {
            return;
        }

        $recipient->notify(new InAppNotification($this->payload(
            $actor,
            $title,
            $message,
            $type,
            $url,
            $context
        )));
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
}
