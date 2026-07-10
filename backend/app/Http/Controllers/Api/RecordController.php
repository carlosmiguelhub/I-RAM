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

    private function staffOwnsRecord(
        Request $request,
        Record $record
    ): bool {
        return $record->created_by === $request->user()->id;
    }

    private function recordRelations(): array
    {
        return [
            'category',
            'department',
            'creator',
            'reviewer',
            'returner',
            'archiver',
            'archiveFolder',
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

    private function storeFiles(
        Request $request,
        Record $record,
        array &$storedFilePaths
    ): int {
        $count = 0;

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
                'file_name' => $uploadedFile->getClientOriginalName(),
                'file_path' => $filePath,
                'file_type' => $uploadedFile->getMimeType(),
                'file_size' => $uploadedFile->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);

            $count++;
        }

        return $count;
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
        } elseif (!$request->filled('status')) {
            // Keep the active Records page focused on submissions and review work.
            // Archived records are managed from the dedicated Archive repository.
            $query->where('status', '!=', 'archived');
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
                    'returned_for_correction',
                    'archived',
                ];

                if (!in_array(
                    $request->status,
                    $allowedStaffStatuses,
                    true
                )) {
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
        ]);

        if ($role === 'Staff') {
            if ($user->department_id === null) {
                return response()->json([
                    'message' => 'Your account is not assigned to a department.',
                ], 422);
            }

            $validated['department_id'] = $user->department_id;
            $validated['storage_location'] = null;
        }

        $validated['status'] = 'received';
        $validated['created_by'] = $user->id;
        $storedFilePaths = [];

        try {
            $record = DB::transaction(function () use (
                $request,
                $validated,
                &$storedFilePaths
            ) {
                $record = Record::create($validated);
                $uploadedCount = $this->storeFiles(
                    $request,
                    $record,
                    $storedFilePaths
                );

                $this->audit(
                    $request,
                    $record,
                    'created_record',
                    'Created record: ' . $record->record_code
                );

                if ($uploadedCount > 0) {
                    $this->audit(
                        $request,
                        $record,
                        'uploaded_record_files',
                        "Uploaded {$uploadedCount} file(s) for record: {$record->record_code}"
                    );
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
                'message' => 'The record could not be submitted.',
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
                'message' => 'The associated record no longer exists.',
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

        if (!Storage::disk('local')->exists(
            $recordFile->file_path
        )) {
            return response()->json([
                'message' => 'The requested file could not be found.',
            ], 404);
        }

        $this->audit(
            $request,
            $record,
            'downloaded_record_file',
            'Downloaded file: ' . $recordFile->file_name
        );

        return Storage::disk('local')->download(
            $recordFile->file_path,
            $recordFile->file_name,
            [
                'Content-Type' => $recordFile->file_type
                    ?: 'application/octet-stream',
            ]
        );
    }

    public function deleteFile(
        Request $request,
        RecordFile $recordFile
    ) {
        $recordFile->load('record');
        $record = $recordFile->record;

        if (!$record) {
            return response()->json([
                'message' => 'The associated record no longer exists.',
            ], 404);
        }

        if (
            $this->roleName($request) !== 'Staff'
            || !$this->staffOwnsRecord($request, $record)
        ) {
            return response()->json([
                'message' => 'You may only remove files from your own submission.',
            ], 403);
        }

        if (!in_array(
            $record->status,
            ['received', 'returned_for_correction'],
            true
        )) {
            return response()->json([
                'message' => 'Files can only be removed before review or while correcting a returned submission.',
            ], 422);
        }

        $fileName = $recordFile->file_name;
        $filePath = $recordFile->file_path;

        DB::transaction(function () use (
            $request,
            $record,
            $recordFile,
            $fileName
        ) {
            $recordFile->delete();

            $this->audit(
                $request,
                $record,
                'removed_record_file',
                "Removed file {$fileName} from record: {$record->record_code}"
            );
        });

        Storage::disk('local')->delete($filePath);

        return response()->json([
            'message' => 'File removed successfully.',
            'record' => $record->fresh()->load(
                $this->recordRelations()
            ),
        ]);
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
            'review_remarks' => ['nullable', 'string', 'max:5000'],
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

            $this->audit(
                $request,
                $record,
                'started_record_review',
                "Started review for record: {$record->record_code}"
            );
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

            $this->audit(
                $request,
                $record,
                'updated_record_review',
                "Updated review details for record: {$record->record_code}"
            );
        });

        return response()->json([
            'message' => 'Review details saved successfully.',
            'record' => $record->fresh()->load(
                $this->recordRelations()
            ),
        ]);
    }

    public function returnForCorrection(
        Request $request,
        Record $record
    ) {
        if ($response = $this->denyRecordManagement($request)) {
            return $response;
        }

        if ($record->status !== 'under_review') {
            return response()->json([
                'message' => 'Only records under review can be returned for correction.',
            ], 422);
        }

        $validated = $request->validate([
            'correction_notes' => [
                'required',
                'string',
                'max:5000',
            ],
        ], [
            'correction_notes.required' =>
                'Correction notes are required before returning the submission.',
        ]);

        DB::transaction(function () use (
            $request,
            $record,
            $validated
        ) {
            $record->update([
                'status' => 'returned_for_correction',
                'correction_notes' =>
                    $validated['correction_notes'],
                'returned_by' => $request->user()->id,
                'returned_at' => now(),
                'resubmitted_at' => null,
                'storage_location' => null,
            ]);

            $this->audit(
                $request,
                $record,
                'returned_record_for_correction',
                "Returned record {$record->record_code} for correction. Notes: {$validated['correction_notes']}"
            );
        });

        return response()->json([
            'message' => 'Record returned to Staff for correction.',
            'record' => $record->fresh()->load(
                $this->recordRelations()
            ),
        ]);
    }

    public function saveCorrection(
        Request $request,
        Record $record
    ) {
        if (
            $this->roleName($request) !== 'Staff'
            || !$this->staffOwnsRecord($request, $record)
        ) {
            return response()->json([
                'message' => 'You may only correct your own returned submission.',
            ], 403);
        }

        if ($record->status !== 'returned_for_correction') {
            return response()->json([
                'message' => 'Only returned submissions can be corrected.',
            ], 422);
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
            'date_received' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
            'files' => ['nullable', 'array', 'max:5'],
            'files.*' => [
                'file',
                'max:10240',
                'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,txt,csv',
            ],
        ]);

        $existingCount = $record->files()->count();
        $newCount = count($request->file('files', []));

        if ($existingCount + $newCount > 5) {
            return response()->json([
                'message' => 'A submission may contain a maximum of 5 files.',
            ], 422);
        }

        $storedFilePaths = [];

        try {
            DB::transaction(function () use (
                $request,
                $record,
                $validated,
                &$storedFilePaths
            ) {
                $record->update([
                    'record_code' => $validated['record_code'],
                    'title' => $validated['title'],
                    'description' =>
                        $validated['description'] ?? null,
                    'category_id' => $validated['category_id'],
                    'department_id' =>
                        $request->user()->department_id,
                    'date_received' => $validated['date_received'],
                    'source' => $validated['source'] ?? null,
                    'remarks' => $validated['remarks'] ?? null,
                ]);

                $uploadedCount = $this->storeFiles(
                    $request,
                    $record,
                    $storedFilePaths
                );

                $this->audit(
                    $request,
                    $record,
                    'updated_returned_record',
                    "Updated correction details for record: {$record->record_code}"
                );

                if ($uploadedCount > 0) {
                    $this->audit(
                        $request,
                        $record,
                        'uploaded_correction_files',
                        "Uploaded {$uploadedCount} correction file(s) for record: {$record->record_code}"
                    );
                }
            });

            return response()->json([
                'message' => 'Corrections saved successfully.',
                'record' => $record->fresh()->load(
                    $this->recordRelations()
                ),
            ]);
        } catch (Throwable $exception) {
            foreach ($storedFilePaths as $filePath) {
                Storage::disk('local')->delete($filePath);
            }

            report($exception);

            return response()->json([
                'message' => 'The corrections could not be saved.',
            ], 500);
        }
    }

    public function resubmit(
        Request $request,
        Record $record
    ) {
        if (
            $this->roleName($request) !== 'Staff'
            || !$this->staffOwnsRecord($request, $record)
        ) {
            return response()->json([
                'message' => 'You may only resubmit your own returned submission.',
            ], 403);
        }

        if ($record->status !== 'returned_for_correction') {
            return response()->json([
                'message' => 'Only returned submissions can be resubmitted.',
            ], 422);
        }

        if ($record->files()->count() === 0) {
            return response()->json([
                'message' => 'Attach at least one file before resubmitting.',
            ], 422);
        }

        DB::transaction(function () use ($request, $record) {
            $record->update([
                'status' => 'received',
                'resubmitted_at' => now(),
                'review_remarks' => null,
                'reviewed_by' => null,
                'reviewed_at' => null,
                'storage_location' => null,
            ]);

            $this->audit(
                $request,
                $record,
                'resubmitted_record',
                "Resubmitted corrected record: {$record->record_code}"
            );
        });

        return response()->json([
            'message' => 'Corrected submission sent back for review.',
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
                'archived_by' => $request->user()->id,
                'archived_at' => now(),
            ]);

            $this->audit(
                $request,
                $record,
                'archived_record',
                "Archived record: {$record->record_code}"
            );
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
            if (!$this->staffOwnsRecord($request, $record)) {
                return response()->json([
                    'message' => 'You may only update your own submission.',
                ], 403);
            }

            if (!in_array(
                $record->status,
                ['received', 'returned_for_correction'],
                true
            )) {
                return response()->json([
                    'message' => 'This submission cannot be edited while it is under review or archived.',
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
            $validated['department_id'] =
                $request->user()->department_id;
        }

        $record->update($validated);

        $this->audit(
            $request,
            $record,
            'updated_record',
            "Updated record metadata: {$record->record_code}"
        );

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

        $recordCode = $record->record_code;
        $recordId = $record->id;

        try {
            DB::transaction(function () use (
                $request,
                $record,
                $recordCode
            ) {
                $this->audit(
                    $request,
                    $record,
                    'deleted_record',
                    'Deleted record: ' . $recordCode
                );

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
