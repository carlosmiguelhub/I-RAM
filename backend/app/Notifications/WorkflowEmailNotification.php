<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WorkflowEmailNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly array $payload
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $actionUrl = rtrim((string) config('iram.frontend_url'), '/')
            .($this->payload['url'] ?? '/dashboard');
        $type = (string) ($this->payload['type'] ?? 'workflow.updated');
        $tone = $this->tone($type);

        $data = [
            'recipientName' => $notifiable->name,
            'title' => $this->payload['title'] ?? 'IRAM update',
            'messageText' => $this->payload['message'] ?? 'There is a new update in IRAM.',
            'typeLabel' => $this->typeLabel($type),
            'actionUrl' => $actionUrl,
            'actionLabel' => $this->actionLabel($type),
            'actor' => $this->payload['actor'] ?? null,
            'details' => $this->details(),
            'accentColor' => $tone['accent'],
            'softColor' => $tone['soft'],
        ];

        return (new MailMessage)
            ->subject('[IRAM] '.($this->payload['title'] ?? 'Workflow update'))
            ->view('emails.workflow-notification', $data)
            ->text('emails.workflow-notification-text', $data);
    }

    private function details(): array
    {
        $labels = [
            'record_code' => 'Record code',
            'record_title' => 'Record title',
            'purpose' => 'Purpose',
            'urgency' => 'Urgency',
            'preferred_format' => 'Preferred format',
            'correction_notes' => 'Correction notes',
            'review_notes' => 'Review notes',
            'review_remarks' => 'Review remarks',
            'claim_code' => 'Claim code',
        ];
        $details = [];

        foreach ($labels as $key => $label) {
            $value = $this->payload[$key] ?? null;

            if ($value !== null && $value !== '') {
                $details[$label] = str_replace('_', ' ', (string) $value);
            }
        }

        return $details;
    }

    private function typeLabel(string $type): string
    {
        return match (true) {
            str_contains($type, 'submitted') => 'New submission',
            str_contains($type, 'resubmitted') => 'Resubmission',
            str_contains($type, 'review_started') => 'Under review',
            str_contains($type, 'returned_for_correction') => 'Action required',
            str_contains($type, 'approved') => 'Approved',
            str_contains($type, 'rejected') => 'Rejected',
            str_contains($type, 'ready_for_pickup') => 'Ready for pickup',
            str_contains($type, 'released') => 'Completed',
            str_contains($type, 'archived') => 'Archived',
            str_contains($type, 'cancelled') => 'Cancelled',
            default => 'Workflow update',
        };
    }

    private function actionLabel(string $type): string
    {
        return str_starts_with($type, 'document_request.')
            ? 'View Document Request'
            : 'View Record';
    }

    private function tone(string $type): array
    {
        if (
            str_contains($type, 'rejected')
            || str_contains($type, 'correction')
            || str_contains($type, 'cancelled')
        ) {
            return ['accent' => '#6B0F2B', 'soft' => '#F8E9EE'];
        }

        if (
            str_contains($type, 'approved')
            || str_contains($type, 'archived')
            || str_contains($type, 'released')
        ) {
            return ['accent' => '#075A3A', 'soft' => '#E6F2EC'];
        }

        return ['accent' => '#B87510', 'soft' => '#FFF3D6'];
    }
}
