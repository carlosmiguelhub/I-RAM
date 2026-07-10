<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Record;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class RecordController extends Controller
{
    private function roleName(Request $request): string
    {
        return $request->user()->role?->name ?? '';
    }

    private function canManageRecords(Request $request): bool
    {
        return in_array($this->roleName($request), ['Admin', 'Records Officer']);
    }

    private function staffCanAccessRecord(Request $request, Record $record): bool
    {
        $user = $request->user();

        return $record->created_by === $user->id ||
            $record->department_id === $user->department_id;
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Record::with(['category', 'department', 'creator']);

        if ($this->roleName($request) === 'Staff') {
            $query->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                    ->orWhere('department_id', $user->department_id);
            });
        }

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('record_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('source', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            if ($this->roleName($request) === 'Staff') {
                $allowedStaffStatuses = ['received', 'under_review'];

                if (!in_array($request->status, $allowedStaffStatuses)) {
                    return response()->json([
                        'message' => 'You are not allowed to view records with this status.',
                    ], 403);
                }
            }

            $query->where('status', $request->status);
        }

        if ($request->filled('department_id')) {
            if ($this->roleName($request) === 'Staff') {
                return response()->json([
                    'message' => 'You are not allowed to filter records by department.',
                ], 403);
            }

            $query->where('department_id', $request->department_id);
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $records = $query->latest()->paginate(10);

        return response()->json($records);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'record_code' => ['required', 'string', 'max:255', 'unique:records,record_code'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'exists:record_categories,id'],
            'department_id' => ['required', 'exists:departments,id'],
            'date_received' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:received,under_review,archived,for_disposal,disposed'],
            'storage_location' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
        ]);

        if ($this->roleName($request) === 'Staff') {
            $validated['department_id'] = $user->department_id;
            $validated['status'] = 'received';
        } else {
            $validated['status'] = $validated['status'] ?? 'received';
        }

        $validated['created_by'] = $user->id;

        $record = Record::create($validated);

        AuditLog::create([
            'user_id' => $user->id,
            'record_id' => $record->id,
            'action' => 'created_record',
            'description' => 'Created record: ' . $record->record_code,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Record created successfully.',
            'record' => $record->load(['category', 'department', 'creator']),
        ], 201);
    }

    public function show(Request $request, Record $record)
    {
        if ($this->roleName($request) === 'Staff' && !$this->staffCanAccessRecord($request, $record)) {
            return response()->json([
                'message' => 'You are not allowed to view this record.',
            ], 403);
        }

        return response()->json([
            'record' => $record->load(['category', 'department', 'creator', 'files', 'auditLogs.user']),
        ]);
    }

    public function update(Request $request, Record $record)
    {
        if ($this->roleName($request) === 'Staff') {
            if (!$this->staffCanAccessRecord($request, $record)) {
                return response()->json([
                    'message' => 'You are not allowed to update this record.',
                ], 403);
            }

            if (!in_array($record->status, ['received', 'under_review'])) {
                return response()->json([
                    'message' => 'You can no longer edit this record because it has already moved forward in the archive process.',
                ], 403);
            }
        }

        $rules = [
            'record_code' => ['required', 'string', 'max:255', 'unique:records,record_code,' . $record->id],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'exists:record_categories,id'],
            'department_id' => ['required', 'exists:departments,id'],
            'date_received' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:255'],
            'storage_location' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
        ];

        if ($this->canManageRecords($request)) {
            $rules['status'] = ['required', 'in:received,under_review,archived,for_disposal,disposed'];
        }

        $validated = $request->validate($rules);

        if ($this->roleName($request) === 'Staff') {
            $validated['department_id'] = $request->user()->department_id;
            $validated['status'] = $record->status;
        }

        $oldStatus = $record->status;

        $record->update($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => 'updated_record',
            'description' => $oldStatus !== $record->status
                ? 'Updated record and changed status from ' . $oldStatus . ' to ' . $record->status
                : 'Updated record: ' . $record->record_code,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Record updated successfully.',
            'record' => $record->load(['category', 'department', 'creator']),
        ]);
    }

    public function destroy(Request $request, Record $record)
    {
        if (!$this->canManageRecords($request)) {
            return response()->json([
                'message' => 'You are not allowed to delete records.',
            ], 403);
        }

        $recordCode = $record->record_code;

        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => 'deleted_record',
            'description' => 'Deleted record: ' . $recordCode,
            'ip_address' => $request->ip(),
        ]);

        $record->delete();

        return response()->json([
            'message' => 'Record deleted successfully.',
        ]);
    }
}