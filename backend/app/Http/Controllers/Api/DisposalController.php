<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DisposalCase;
use App\Models\Record;
use App\Models\SystemSetting;
use App\Services\InAppNotificationService;
use App\Services\RecordDisposalService;
use App\Services\RecordRetentionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DisposalController extends Controller
{
    public function __construct(
        private readonly RecordRetentionService $retention,
        private readonly RecordDisposalService $disposals,
        private readonly InAppNotificationService $notifications
    ) {}

    private function authorized(Request $request): bool
    {
        return in_array(
            $request->user()->role?->name,
            ['Admin', 'Records Officer'],
            true
        );
    }

    private function deny(Request $request)
    {
        if (! $this->authorized($request)) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may access the For Disposal Repository.',
            ], 403);
        }

        return null;
    }

    private function relations(): array
    {
        return [
            'category',
            'department',
            'creator',
            'archiver',
            'archiveFolder',
            'files',
            'disposer',
            'legalHoldAuthor:id,name',
            'latestDisposalCase.requester:id,name',
            'latestDisposalCase.approver:id,name',
            'latestDisposalCase.rejecter:id,name',
            'latestDisposalCase.canceller:id,name',
        ];
    }

    private function audit(
        Request $request,
        Record $record,
        string $action,
        string $description
    ): void {
        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => $action,
            'description' => $description,
            'ip_address' => $request->ip(),
        ]);
    }

    public function index(Request $request)
    {
        if ($response = $this->deny($request)) {
            return $response;
        }

        $this->retention->moveExpiredRecords();
        $this->disposals->processApprovedCases();

        $query = Record::with($this->relations())
            ->where('status', 'for_disposal');

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function ($query) use ($search) {
                $query
                    ->where('record_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $records = $query->latest('for_disposal_at')->paginate(12);

        return response()->json([
            ...$records->toArray(),
            'grace_days' => $this->graceDays(),
        ]);
    }

    public function disposed(Request $request)
    {
        if ($response = $this->deny($request)) {
            return $response;
        }

        $this->disposals->processApprovedCases();

        $query = Record::with($this->relations())
            ->where('status', 'disposed');

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function ($query) use ($search) {
                $query
                    ->where('record_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $records = $query->latest('disposed_at')->paginate(12);

        return response()->json([
            ...$records->toArray(),
            'grace_days' => $this->graceDays(),
        ]);
    }

    public function restore(
        Request $request,
        Record $record
    ) {
        if ($response = $this->deny($request)) {
            return $response;
        }

        if ($record->status !== 'for_disposal') {
            return response()->json([
                'message' => 'Only records awaiting disposal may be returned to the archive.',
            ], 422);
        }

        if ($record->legal_hold) {
            return response()->json([
                'message' => 'Release the legal hold before returning this record to the archive.',
            ], 422);
        }

        if ($record->disposalCases()
            ->whereIn('status', ['pending', 'approved'])
            ->exists()) {
            return response()->json([
                'message' => 'Cancel the active disposal request before returning this record to the archive.',
            ], 422);
        }

        $validated = $request->validate([
            'retention_type' => [
                'required',
                Rule::in(['permanent', 'temporary']),
            ],
            'retention_years' => [
                Rule::requiredIf(
                    $request->input('retention_type') === 'temporary'
                ),
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
            'retention_unit' => [
                'sometimes',
                Rule::in(['years', 'minutes']),
            ],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $temporary = $validated['retention_type'] === 'temporary';
        $retentionUnit = $temporary
            ? ($validated['retention_unit'] ?? 'years')
            : 'years';
        $years = $temporary
            ? (int) $validated['retention_years']
            : null;

        if ($retentionUnit === 'minutes' && $years !== 1) {
            return response()->json([
                'message' => 'Practice retention must be exactly 1 minute.',
            ], 422);
        }

        DB::transaction(function () use (
            $request,
            $record,
            $validated,
            $temporary,
            $retentionUnit,
            $years
        ) {
            $record->update([
                'status' => 'archived',
                'retention_type' => $validated['retention_type'],
                'retention_years' => $years,
                'retention_unit' => $retentionUnit,
                'retention_expires_at' => $temporary
                    ? ($retentionUnit === 'minutes'
                        ? now()->addMinute()
                        : now()->addYears($years))
                    : null,
                'for_disposal_at' => null,
                'staff_visible' => $record->access_level === 'internal',
                'disposal_notes' => $validated['notes'] ?? null,
            ]);

            $this->audit(
                $request,
                $record,
                'restored_record_from_disposal',
                "Returned {$record->record_code} to the Archive Repository with {$validated['retention_type']} retention"
            );
        });

        return response()->json([
            'message' => 'Record returned to the Archive Repository.',
            'record' => $record->fresh()->load($this->relations()),
        ]);
    }

    public function requestDisposal(
        Request $request,
        Record $record
    ) {
        if ($response = $this->deny($request)) {
            return $response;
        }

        if ($record->status !== 'for_disposal') {
            return response()->json([
                'message' => 'Only records in the For Disposal Repository may be submitted for approval.',
            ], 422);
        }

        if ($record->legal_hold) {
            return response()->json([
                'message' => 'This record is under legal hold and cannot be submitted for disposal.',
            ], 422);
        }

        if ($record->disposalCases()
            ->whereIn('status', ['pending', 'approved'])
            ->exists()) {
            return response()->json([
                'message' => 'This record already has an active disposal request.',
            ], 422);
        }

        $validated = $request->validate([
            'authority_reference' => [
                'required',
                'string',
                'max:255',
            ],
            'reason' => ['required', 'string', 'max:5000'],
            'disposal_method' => [
                'required',
                Rule::in([
                    'secure_digital_deletion',
                    'physical_shredding',
                    'certified_destruction',
                    'other',
                ]),
            ],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $case = DB::transaction(function () use (
            $request,
            $record,
            $validated
        ) {
            $case = DisposalCase::create([
                'record_id' => $record->id,
                'requested_by' => $request->user()->id,
                'status' => 'pending',
                'authority_reference' => $validated['authority_reference'],
                'reason' => $validated['reason'],
                'disposal_method' => $validated['disposal_method'],
                'notes' => $validated['notes'] ?? null,
                'requested_at' => now(),
            ]);

            $this->audit(
                $request,
                $record,
                'disposal_approval_requested',
                "Requested disposal approval for {$record->record_code} under authority {$validated['authority_reference']}"
            );

            return $case;
        });

        $this->notifications->notifyManagers(
            $request->user(),
            'Disposal approval requested',
            "{$request->user()->name} submitted {$record->record_code} for disposal approval.",
            'record.disposal_requested',
            '/disposal',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
                'disposal_case_id' => $case->id,
                'authority_reference' => $case->authority_reference,
            ]
        );

        return response()->json([
            'message' => 'Disposal request submitted for independent approval.',
            'record' => $record->fresh()->load($this->relations()),
        ], 201);
    }

    public function approve(
        Request $request,
        DisposalCase $disposalCase
    ) {
        if ($response = $this->deny($request)) {
            return $response;
        }

        $disposalCase->load('record');
        $record = $disposalCase->record;

        if (
            $disposalCase->status !== 'pending'
            || ! $record
            || $record->status !== 'for_disposal'
        ) {
            return response()->json([
                'message' => 'Only pending disposal requests may be approved.',
            ], 422);
        }

        if ((int) $disposalCase->requested_by === (int) $request->user()->id) {
            return response()->json([
                'message' => 'The requester cannot approve their own disposal request.',
            ], 403);
        }

        if ($record->legal_hold) {
            return response()->json([
                'message' => 'Remove the legal hold before approving disposal.',
            ], 422);
        }

        $request->validate([
            'confirmation' => [
                'required',
                Rule::in([$record->record_code]),
            ],
        ]);

        $graceDays = $this->graceDays();
        $scheduledAt = now()->addDays($graceDays);
        $certificate = sprintf(
            'DC-%s-%06d',
            now()->format('Y'),
            $disposalCase->id
        );

        DB::transaction(function () use (
            $request,
            $disposalCase,
            $record,
            $scheduledAt,
            $certificate
        ) {
            $disposalCase->update([
                'status' => 'approved',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
                'scheduled_purge_at' => $scheduledAt,
                'certificate_number' => $certificate,
                'rejection_reason' => null,
            ]);

            $this->audit(
                $request,
                $record,
                'disposal_approved',
                "Approved disposal for {$record->record_code}; attachment purge scheduled for {$scheduledAt->toDateTimeString()} under certificate {$certificate}"
            );
        });

        $this->notifications->notifyUser(
            $disposalCase->requester,
            $request->user(),
            'Disposal request approved',
            "{$record->record_code} was approved. Attachments are scheduled for permanent deletion after the {$graceDays}-day grace period.",
            'record.disposal_approved',
            '/disposal',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
                'certificate_number' => $certificate,
                'scheduled_purge_at' => $scheduledAt->toISOString(),
            ]
        );

        return response()->json([
            'message' => "Disposal approved. The {$graceDays}-day cancellation period has started.",
            'record' => $record->fresh()->load($this->relations()),
        ]);
    }

    public function reject(
        Request $request,
        DisposalCase $disposalCase
    ) {
        if ($response = $this->deny($request)) {
            return $response;
        }

        if ($disposalCase->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending disposal requests may be rejected.',
            ], 422);
        }

        if ((int) $disposalCase->requested_by === (int) $request->user()->id) {
            return response()->json([
                'message' => 'The requester cannot review their own disposal request.',
            ], 403);
        }

        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:5000'],
        ]);
        $record = $disposalCase->record;

        $disposalCase->update([
            'status' => 'rejected',
            'rejected_by' => $request->user()->id,
            'rejected_at' => now(),
            'rejection_reason' => $validated['rejection_reason'],
        ]);

        $this->audit(
            $request,
            $record,
            'disposal_rejected',
            "Rejected disposal request for {$record->record_code}: {$validated['rejection_reason']}"
        );

        $this->notifications->notifyUser(
            $disposalCase->requester,
            $request->user(),
            'Disposal request rejected',
            "{$record->record_code} disposal was rejected: {$validated['rejection_reason']}",
            'record.disposal_rejected',
            '/disposal',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
            ]
        );

        return response()->json([
            'message' => 'Disposal request rejected.',
            'record' => $record->fresh()->load($this->relations()),
        ]);
    }

    public function cancel(
        Request $request,
        DisposalCase $disposalCase
    ) {
        if ($response = $this->deny($request)) {
            return $response;
        }

        if (! in_array($disposalCase->status, ['pending', 'approved'], true)) {
            return response()->json([
                'message' => 'This disposal request can no longer be cancelled.',
            ], 422);
        }

        $role = $request->user()->role?->name;
        if (
            (int) $disposalCase->requested_by !== (int) $request->user()->id
            && $role !== 'Admin'
        ) {
            return response()->json([
                'message' => 'Only the requester or an Administrator may cancel this disposal.',
            ], 403);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:5000'],
        ]);
        $record = $disposalCase->record;

        $disposalCase->update([
            'status' => 'cancelled',
            'cancelled_by' => $request->user()->id,
            'cancelled_at' => now(),
            'notes' => trim(
                ($disposalCase->notes ? $disposalCase->notes."\n\n" : '')
                .'Cancellation: '.$validated['reason']
            ),
        ]);

        $this->audit(
            $request,
            $record,
            'disposal_cancelled',
            "Cancelled disposal for {$record->record_code}: {$validated['reason']}"
        );

        $this->notifications->notifyManagers(
            $request->user(),
            'Disposal cancelled',
            "{$record->record_code} disposal was cancelled before file deletion.",
            'record.disposal_cancelled',
            '/disposal',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
            ]
        );

        return response()->json([
            'message' => 'Disposal cancelled. No attachments were deleted.',
            'record' => $record->fresh()->load($this->relations()),
        ]);
    }

    public function updateLegalHold(
        Request $request,
        Record $record
    ) {
        if ($response = $this->deny($request)) {
            return $response;
        }

        if ($record->status !== 'for_disposal') {
            return response()->json([
                'message' => 'Legal hold can only be changed while a record awaits disposal.',
            ], 422);
        }

        $validated = $request->validate([
            'legal_hold' => ['required', 'boolean'],
            'reason' => [
                Rule::requiredIf($request->boolean('legal_hold')),
                'nullable',
                'string',
                'max:5000',
            ],
        ]);
        $placing = (bool) $validated['legal_hold'];

        DB::transaction(function () use (
            $request,
            $record,
            $validated,
            $placing
        ) {
            $record->update([
                'legal_hold' => $placing,
                'legal_hold_reason' => $placing
                    ? $validated['reason']
                    : null,
                'legal_hold_by' => $placing
                    ? $request->user()->id
                    : null,
                'legal_hold_at' => $placing ? now() : null,
            ]);

            if (! $placing) {
                $graceDays = max(
                    1,
                    (int) SystemSetting::getValue(
                        'disposal_grace_days',
                        30
                    )
                );
                $record->disposalCases()
                    ->where('status', 'approved')
                    ->update([
                        'scheduled_purge_at' => now()->addDays($graceDays),
                        'purge_reminder_sent_at' => null,
                    ]);
            }

            $this->audit(
                $request,
                $record,
                $placing ? 'legal_hold_placed' : 'legal_hold_released',
                $placing
                    ? "Placed legal hold on {$record->record_code}: {$validated['reason']}"
                    : "Released legal hold on {$record->record_code}; grace period restarted"
            );
        });

        return response()->json([
            'message' => $placing
                ? 'Legal hold placed. File deletion is blocked.'
                : 'Legal hold released. A new grace period has started.',
            'record' => $record->fresh()->load($this->relations()),
        ]);
    }

    public function certificate(
        Request $request,
        DisposalCase $disposalCase
    ) {
        if ($response = $this->deny($request)) {
            return $response;
        }

        if (! in_array($disposalCase->status, ['approved', 'completed'], true)) {
            return response()->json([
                'message' => 'A certificate is available only after disposal approval.',
            ], 422);
        }

        return response()->json([
            'certificate' => $disposalCase->load([
                'record.category',
                'record.department',
                'record.files',
                'requester:id,name',
                'approver:id,name',
            ]),
        ]);
    }

    private function graceDays(): int
    {
        return max(
            1,
            min(
                365,
                (int) SystemSetting::getValue(
                    'disposal_grace_days',
                    30
                )
            )
        );
    }
}
