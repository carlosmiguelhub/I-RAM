<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\DisposalCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class RecordDisposalService
{
    public function __construct(
        private readonly InAppNotificationService $notifications
    ) {}

    public function processApprovedCases(): array
    {
        $reminded = $this->sendUpcomingPurgeReminders();
        $completed = 0;
        $failed = 0;

        DisposalCase::query()
            ->with(['record.files'])
            ->where('status', 'approved')
            ->whereNotNull('scheduled_purge_at')
            ->where('scheduled_purge_at', '<=', now())
            ->whereHas('record', fn ($query) => $query
                ->where('status', 'for_disposal')
                ->where('legal_hold', false))
            ->orderBy('id')
            ->chunkById(50, function ($cases) use (&$completed, &$failed) {
                foreach ($cases as $case) {
                    try {
                        if ($this->purgeCase($case)) {
                            $completed++;
                        }
                    } catch (Throwable $exception) {
                        report($exception);
                        $failed++;
                    }
                }
            });

        return compact('reminded', 'completed', 'failed');
    }

    public function purgeCase(DisposalCase $case): bool
    {
        $case->loadMissing(['record.files']);
        $record = $case->record;

        if (
            ! $record
            || $case->status !== 'approved'
            || $record->status !== 'for_disposal'
            || $record->legal_hold
            || ! $case->scheduled_purge_at
            || $case->scheduled_purge_at->isFuture()
        ) {
            return false;
        }

        foreach ($record->files as $file) {
            if ($file->purged_at) {
                continue;
            }

            if (
                Storage::disk('local')->exists($file->file_path)
                && ! Storage::disk('local')->delete($file->file_path)
            ) {
                throw new RuntimeException(
                    "Failed to permanently delete {$file->file_path}."
                );
            }

            $file->update([
                'purged_at' => now(),
                'purged_by' => $case->approved_by,
                'purge_reason' => "Approved disposal case {$case->certificate_number}",
            ]);
        }

        DB::transaction(function () use ($case, $record) {
            $completedAt = now();

            $case->update([
                'status' => 'completed',
                'completed_at' => $completedAt,
            ]);

            $record->update([
                'status' => 'disposed',
                'disposed_by' => $case->approved_by,
                'disposed_at' => $completedAt,
                'disposal_notes' => $case->reason,
                'staff_visible' => false,
            ]);

            AuditLog::create([
                'user_id' => $case->approved_by,
                'record_id' => $record->id,
                'action' => 'disposal_files_purged',
                'description' => "Permanently deleted physical attachments for {$record->record_code}; metadata retained under certificate {$case->certificate_number}",
                'ip_address' => null,
            ]);
        });

        $this->notifications->notifyManagersFromSystem(
            'Approved disposal completed',
            "{$record->record_code} attachments were permanently deleted. Its metadata and certificate remain available.",
            'record.disposal_completed',
            '/disposal?view=disposed',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
                'certificate_number' => $case->certificate_number,
            ]
        );

        return true;
    }

    private function sendUpcomingPurgeReminders(): int
    {
        $count = 0;

        DisposalCase::query()
            ->with('record:id,record_code,title,legal_hold')
            ->where('status', 'approved')
            ->whereNull('purge_reminder_sent_at')
            ->whereBetween('scheduled_purge_at', [
                now(),
                now()->addDays(3),
            ])
            ->each(function (DisposalCase $case) use (&$count) {
                if (! $case->record || $case->record->legal_hold) {
                    return;
                }

                $this->notifications->notifyManagersFromSystem(
                    'File deletion approaching',
                    "{$case->record->record_code} is scheduled for permanent attachment deletion on {$case->scheduled_purge_at->format('M j, Y g:i A')}.",
                    'record.disposal_reminder',
                    '/disposal',
                    [
                        'record_id' => $case->record_id,
                        'record_code' => $case->record->record_code,
                        'certificate_number' => $case->certificate_number,
                        'scheduled_purge_at' => $case->scheduled_purge_at->toISOString(),
                    ]
                );

                $case->update([
                    'purge_reminder_sent_at' => now(),
                ]);
                $count++;
            });

        return $count;
    }
}
