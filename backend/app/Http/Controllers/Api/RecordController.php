<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Record;
use App\Models\RecordFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class RecordController extends Controller
{
    private function roleName(Request $request): string
    {
        return $request->user()->role?->name ?? '';
    }

    private function canManageRecords(Request $request): bool
    {
        return in_array(
            $this->roleName($request),
            ['Admin', 'Records Officer'],
            true
        );
    }

    private function staffCanAccessRecord(
        Request $request,
        Record $record
    ): bool {
        $user = $request->user();

        return $record->created_by === $user->id
            || (
                $user->department_id !== null
                && $record->department_id === $user->department_id
            );
    }

    private function recordRelations(): array
    {
        return [
            'category',
            'department',
            'creator',
            'reviewer',
            'archiver',
            'files',
        ];
    }

    private function denyRecordManagement(Request $request)
    {
        if (!$this->canManageRecords($request)) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may perform this action.',
            ], 403);
        }

        return null;
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Record::with($this->recordRelations());

        if ($this->roleName($request) === 'Staff') {
            $query->where(function ($query) use ($user) {
                $query->where('created_by', $user->id);

                if ($user->department_id !== null) {
                    $query->orWhere(
                        'department_id',
                        $user->department_id
                    );
                }
            });
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);

            $query->where(function ($query) use ($search) {
                $query
                    ->where('record_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('source', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            if ($this->roleName($request) === 'Staff') {
                $allowedStaffStatuses = [
                    'received',
                    'under_review',
                    'archived',
                ];

                if (
                    !in_array(
                        $request->status,
                        $allowedStaffStatuses,
                        true
                    )
                ) {
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

            $query->where(
                'department_id',
                $request->department_id
            );
        }

        if ($request->filled('category_id')) {
            $query->where(
                'category_id',
                $request->category_id
            );
        }

        return response()->json(
            $query->latest()->paginate(10)
        );
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $role = $this->roleName($request);

        $validated = $request->validate([
            'record_code' => [
                'required',
                'string',
                'max:255',
                'unique:records,record_code',
            ],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => [
                'required',
                'exists:record_categories,id',
            ],
            'department_id' => [
                'required',
                'exists:departments,id',
            ],
            'date_received' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:255'],
            'storage_location' => [
                'nullable',
                'string',
                'max:255',
            ],
            'remarks' => ['nullable', 'string'],
            'files' => ['nullable', 'array', 'max:5'],
            'files.*' => [
                'file',
                'max:10240',
                'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,txt,csv',
            ],
        ], [
            'files.array' => 'The uploaded files must be submitted as a file list.',
            'files.max' => 'You may upload a maximum of 5 files.',
            'files.*.file' => 'Each attachment must be a valid file.',
            'files.*.max' => 'Each file must not exceed 10 MB.',
            'files.*.mimes' => 'Allowed file types are PDF, Word, Excel, PowerPoint, JPG, PNG, TXT, and CSV.',
        ]);

        if ($role === 'Staff') {
            if ($user->department_id === null) {
                return response()->json([
                    'message' => 'Your account is not assigned to a department. Please contact an administrator.',
                ], 422);
            }

            $validated['department_id'] = $user->department_id;
            $validated['storage_location'] = null;
        }

        $validated['status'] = 'received';
        $validated['created_by'] = $user->id;

        unset($validated['files']);

        $storedFilePaths = [];

        try {
            $record = DB::transaction(function () use (
                $request,
                $user,
                $validated,
                &$storedFilePaths
            ) {
                $record = Record::create($validated);

                foreach ($request->file('files', []) as $uploadedFile) {
                    $extension = strtolower(
                        $uploadedFile->getClientOriginalExtension()
                    );

                    $storedFileName = Str::uuid()->toString();

                    if ($extension !== '') {
                        $storedFileName .= '.' . $extension;
                    }

                    $filePath = $uploadedFile->storeAs(
                        'records/' . $record->id,
                        $storedFileName,
                        'local'
                    );

                    if ($filePath === false) {
                        throw new \RuntimeException(
                            'Failed to store an uploaded file.'
                        );
                    }

                    $storedFilePaths[] = $filePath;

                    RecordFile::create([
                        'record_id' => $record->id,
                        'file_name' => $uploadedFile
                            ->getClientOriginalName(),
                        'file_path' => $filePath,
                        'file_type' => $uploadedFile->getMimeType(),
                        'file_size' => $uploadedFile->getSize(),
                        'uploaded_by' => $user->id,
                    ]);
                }

                AuditLog::create([
                    'user_id' => $user->id,
                    'record_id' => $record->id,
                    'action' => 'created_record',
                    'description' => 'Created record: '
                        . $record->record_code,
                    'ip_address' => $request->ip(),
                ]);

                $uploadedFileCount = count(
                    $request->file('files', [])
                );

                if ($uploadedFileCount > 0) {
                    AuditLog::create([
                        'user_id' => $user->id,
                        'record_id' => $record->id,
                        'action' => 'uploaded_record_files',
                        'description' => 'Uploaded '
                            . $uploadedFileCount
                            . ' file(s) for record: '
                            . $record->record_code,
                        'ip_address' => $request->ip(),
                    ]);
                }

                return $record;
            });

            return response()->json([
                'message' => 'Record submitted successfully.',
                'record' => $record->load(
                    $this->recordRelations()
                ),
            ], 201);
        } catch (Throwable $exception) {
            foreach ($storedFilePaths as $filePath) {
                Storage::disk('local')->delete($filePath);
            }

            report($exception);

            return response()->json([
                'message' => 'The record could not be submitted. Please try again.',
            ], 500);
        }
    }

    public function show(Request $request, Record $record)
    {
        if (
            $this->roleName($request) === 'Staff'
            && !$this->staffCanAccessRecord($request, $record)
        ) {
            return response()->json([
                'message' => 'You are not allowed to view this record.',
            ], 403);
        }

        return response()->json([
            'record' => $record->load([
                ...$this->recordRelations(),
                'auditLogs.user',
            ]),
        ]);
    }

    public function downloadFile(
        Request $request,
        RecordFile $recordFile
    ) {
        $recordFile->load('record');

        $record = $recordFile->record;

        if (!$record) {
            return response()->json([
                'message' => 'The record associated with this file no longer exists.',
            ], 404);
        }

        if (
            $this->roleName($request) === 'Staff'
            && !$this->staffCanAccessRecord($request, $record)
        ) {
            return response()->json([
                'message' => 'You are not allowed to download this file.',
            ], 403);
        }

        if (
            !Storage::disk('local')->exists(
                $recordFile->file_path
            )
        ) {
            return response()->json([
                'message' => 'The requested file could not be found in storage.',
            ], 404);
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => 'downloaded_record_file',
            'description' => 'Downloaded file: '
                . $recordFile->file_name,
            'ip_address' => $request->ip(),
        ]);

        return Storage::disk('local')->download(
            $recordFile->file_path,
            $recordFile->file_name,
            [
                'Content-Type' => $recordFile->file_type
                    ?: 'application/octet-stream',
            ]
        );
    }

    public function startReview(
        Request $request,
        Record $record
    ) {
        if ($response = $this->denyRecordManagement($request)) {
            return $response;
        }

        if ($record->status !== 'received') {
            return response()->json([
                'message' => 'Only received records can be moved to under review.',
            ], 422);
        }

        $validated = $request->validate([
            'review_remarks' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use (
            $request,
            $record,
            $validated
        ) {
            $record->update([
                'status' => 'under_review',
                'review_remarks' =>
                    $validated['review_remarks'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => $request->user()->id,
                'record_id' => $record->id,
                'action' => 'started_record_review',
                'description' => 'Started review for record: '
                    . $record->record_code
                    . ' (received to under_review)',
                'ip_address' => $request->ip(),
            ]);
        });

        return response()->json([
            'message' => 'Record review started successfully.',
            'record' => $record->fresh()->load(
                $this->recordRelations()
            ),
        ]);
    }

    public function updateReview(
        Request $request,
        Record $record
    ) {
        if ($response = $this->denyRecordManagement($request)) {
            return $response;
        }

        if ($record->status !== 'under_review') {
            return response()->json([
                'message' => 'Review details can only be updated while the record is under review.',
            ], 422);
        }

        $validated = $request->validate([
            'review_remarks' => [
                'nullable',
                'string',
                'max:5000',
            ],
            'storage_location' => [
                'nullable',
                'string',
                'max:255',
            ],
        ]);

        DB::transaction(function () use (
            $request,
            $record,
            $validated
        ) {
            $record->update([
                'review_remarks' =>
                    $validated['review_remarks']
                    ?? $record->review_remarks,
                'storage_location' =>
                    $validated['storage_location']
                    ?? $record->storage_location,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => $request->user()->id,
                'record_id' => $record->id,
                'action' => 'updated_record_review',
                'description' => 'Updated review details for record: '
                    . $record->record_code,
                'ip_address' => $request->ip(),
            ]);
        });

        return response()->json([
            'message' => 'Review details saved successfully.',
            'record' => $record->fresh()->load(
                $this->recordRelations()
            ),
        ]);
    }

    public function archive(
        Request $request,
        Record $record
    ) {
        if ($response = $this->denyRecordManagement($request)) {
            return $response;
        }

        if ($record->status !== 'under_review') {
            return response()->json([
                'message' => 'Only records under review can be archived.',
            ], 422);
        }

        $validated = $request->validate([
            'review_remarks' => [
                'required',
                'string',
                'max:5000',
            ],
            'storage_location' => [
                'required',
                'string',
                'max:255',
            ],
        ], [
            'review_remarks.required' =>
                'Review remarks are required before archiving.',
            'storage_location.required' =>
                'A storage location is required before archiving.',
        ]);

        DB::transaction(function () use (
            $request,
            $record,
            $validated
        ) {
            $record->update([
                'status' => 'archived',
                'review_remarks' =>
                    $validated['review_remarks'],
                'storage_location' =>
                    $validated['storage_location'],
                'reviewed_by' =>
                    $record->reviewed_by
                    ?: $request->user()->id,
                'reviewed_at' =>
                    $record->reviewed_at ?: now(),
                'archived_by' => $request->user()->id,
                'archived_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => $request->user()->id,
                'record_id' => $record->id,
                'action' => 'archived_record',
                'description' => 'Archived record: '
                    . $record->record_code
                    . ' (under_review to archived)',
                'ip_address' => $request->ip(),
            ]);
        });

        return response()->json([
            'message' => 'Record archived successfully.',
            'record' => $record->fresh()->load(
                $this->recordRelations()
            ),
        ]);
    }

    public function update(Request $request, Record $record)
    {
        if ($this->roleName($request) === 'Staff') {
            if (
                !$this->staffCanAccessRecord(
                    $request,
                    $record
                )
            ) {
                return response()->json([
                    'message' => 'You are not allowed to update this record.',
                ], 403);
            }

            if (
                !in_array(
                    $record->status,
                    ['received', 'under_review'],
                    true
                )
            ) {
                return response()->json([
                    'message' => 'You can no longer edit this record because it has already moved forward in the archive process.',
                ], 403);
            }
        }

        $validated = $request->validate([
            'record_code' => [
                'required',
                'string',
                'max:255',
                'unique:records,record_code,' . $record->id,
            ],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => [
                'required',
                'exists:record_categories,id',
            ],
            'department_id' => [
                'required',
                'exists:departments,id',
            ],
            'date_received' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
        ]);

        if ($this->roleName($request) === 'Staff') {
            if ($request->user()->department_id === null) {
                return response()->json([
                    'message' => 'Your account is not assigned to a department.',
                ], 422);
            }

            $validated['department_id'] =
                $request->user()->department_id;
        }

        $record->update($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => 'updated_record',
            'description' => 'Updated record metadata: '
                . $record->record_code,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Record updated successfully.',
            'record' => $record->load(
                $this->recordRelations()
            ),
        ]);
    }

    public function destroy(Request $request, Record $record)
    {
        if (!$this->canManageRecords($request)) {
            return response()->json([
                'message' => 'You are not allowed to delete records.',
            ], 403);
        }

        $record->load('files');

        $recordCode = $record->record_code;
        $recordId = $record->id;

        try {
            DB::transaction(function () use (
                $request,
                $record,
                $recordCode
            ) {
                AuditLog::create([
                    'user_id' => $request->user()->id,
                    'record_id' => $record->id,
                    'action' => 'deleted_record',
                    'description' => 'Deleted record: '
                        . $recordCode,
                    'ip_address' => $request->ip(),
                ]);

                $record->delete();
            });

            Storage::disk('local')->deleteDirectory(
                'records/' . $recordId
            );

            return response()->json([
                'message' => 'Record deleted successfully.',
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'message' => 'The record could not be deleted.',
            ], 500);
        }
    }
}
