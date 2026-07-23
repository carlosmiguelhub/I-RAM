<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Record;
use App\Services\RecordRetentionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DisposalController extends Controller
{
    public function __construct(
        private readonly RecordRetentionService $retention
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

        return response()->json(
            $query->latest('for_disposal_at')->paginate(12)
        );
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

    public function dispose(
        Request $request,
        Record $record
    ) {
        if ($response = $this->deny($request)) {
            return $response;
        }

        if ($record->status !== 'for_disposal') {
            return response()->json([
                'message' => 'Only records awaiting disposal can be marked disposed.',
            ], 422);
        }

        $validated = $request->validate([
            'disposal_notes' => [
                'required',
                'string',
                'max:5000',
            ],
        ]);

        DB::transaction(function () use ($request, $record, $validated) {
            $record->update([
                'status' => 'disposed',
                'disposed_by' => $request->user()->id,
                'disposed_at' => now(),
                'disposal_notes' => $validated['disposal_notes'],
                'staff_visible' => false,
            ]);

            $this->audit(
                $request,
                $record,
                'disposed_record',
                "Marked {$record->record_code} as disposed: {$validated['disposal_notes']}"
            );
        });

        return response()->json([
            'message' => 'Record marked as disposed. Its audit metadata remains available.',
        ]);
    }
}
