<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Record;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class RecordController extends Controller
{
    public function index(Request $request)
    {
        $query = Record::with(['category', 'department', 'creator']);

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
            $query->where('status', $request->status);
        }

        if ($request->filled('department_id')) {
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

        $validated['created_by'] = $request->user()->id;
        $validated['status'] = $validated['status'] ?? 'received';

        $record = Record::create($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
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

    public function show(Record $record)
    {
        return response()->json([
            'record' => $record->load(['category', 'department', 'creator', 'files', 'auditLogs.user']),
        ]);
    }

    public function update(Request $request, Record $record)
    {
        $validated = $request->validate([
            'record_code' => ['required', 'string', 'max:255', 'unique:records,record_code,' . $record->id],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'exists:record_categories,id'],
            'department_id' => ['required', 'exists:departments,id'],
            'date_received' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'in:received,under_review,archived,for_disposal,disposed'],
            'storage_location' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
        ]);

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