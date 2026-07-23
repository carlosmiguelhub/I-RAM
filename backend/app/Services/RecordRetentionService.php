<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Record;

class RecordRetentionService
{
    public function __construct(
        private readonly InAppNotificationService $notifications
    ) {}

    public function moveExpiredRecords(): int
    {
        $moved = 0;

        Record::query()
            ->where('status', 'archived')
            ->where('retention_type', 'temporary')
            ->whereNotNull('retention_expires_at')
            ->where('retention_expires_at', '<=', now())
            ->orderBy('id')
            ->chunkById(100, function ($records) use (&$moved) {
                foreach ($records as $record) {
                    if ($this->moveToDisposal($record)) {
                        $moved++;
                    }
                }
            });

        return $moved;
    }

    public function moveToDisposal(Record $record): bool
    {
        $updated = Record::query()
            ->whereKey($record->id)
            ->where('status', 'archived')
            ->update([
                'status' => 'for_disposal',
                'for_disposal_at' => now(),
                'staff_visible' => false,
            ]);

        if ($updated === 0) {
            return false;
        }

        $record->refresh();

        AuditLog::create([
            'user_id' => null,
            'record_id' => $record->id,
            'action' => 'retention_expired',
            'description' => "Retention expired; {$record->record_code} was automatically transferred to the For Disposal Repository",
            'ip_address' => null,
        ]);

        $this->notifications->notifyManagersFromSystem(
            'Record ready for disposal review',
            "{$record->record_code}: {$record->title} reached the end of its retention period.",
            'record.for_disposal',
            '/disposal',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
                'record_title' => $record->title,
                'retention_expires_at' => $record->retention_expires_at?->toISOString(),
            ]
        );

        return true;
    }
}
