<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\DocumentRequest;
use App\Models\Record;
use App\Models\RecordFile;
use App\Models\SystemSetting;
use App\Services\InAppNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

class RecordController extends Controller
{
    public function __construct(
        private readonly InAppNotificationService $notifications
    ) {}

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

    private function canManageWorkflow(Request $request): bool
    {
        $role = $this->roleName($request);

        if ($role === 'Records Officer') {
            return true;
        }

        return $role === 'Admin'
            && (bool) SystemSetting::getValue(
                'allow_admin_review',
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

    private function userOwnsRecord(
        Request $request,
        Record $record
    ): bool {
        return (int) $record->created_by ===
            (int) $request->user()->id;
    }

    private function canViewRecord(
        Request $request,
        Record $record
    ): bool {
        if ($this->canManageRecords($request)) {
            return true;
        }

        if ($this->roleName($request) !== 'Staff') {
            return false;
        }

        if (in_array($record->status, ['for_disposal', 'disposed'], true)) {
            return false;
        }

        if ($record->status !== 'archived') {
            return $this->staffCanAccessRecord($request, $record);
        }

        return $this->hasActiveDocumentAccess($request, $record);
    }

    private function hasActiveDocumentAccess(
        Request $request,
        Record $record
    ): bool {
        if (
            ! $record->staff_visible
            || $record->access_level === 'confidential'
        ) {
            return false;
        }

        return DocumentRequest::query()
            ->where('record_id', $record->id)
            ->where('requested_by', $request->user()->id)
            ->whereIn('status', [
                'approved',
                'ready_for_pickup',
                'released',
            ])
            ->where(function ($query) {
                $query
                    ->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->exists();
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
            'disposer',
            'archiveFolder',
            'files',
        ];
    }

    private function denyRecordManagement(Request $request)
    {
        if (! $this->canManageWorkflow($request)) {
            return response()->json([
                'message' => 'Only an authorized Records Officer may perform this workflow action.',
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

    private function generatedRecordCode(Record $record): string
    {
        $prefix = strtoupper((string) SystemSetting::getValue(
            'record_code_prefix',
            'IRAM'
        ));
        $prefix = preg_replace('/[^A-Z0-9]+/', '', $prefix) ?: 'IRAM';
        $baseCode = sprintf(
            '%s-%s-R%06d',
            $prefix,
            now()->format('Y'),
            $record->id
        );
        $code = $baseCode;
        $suffix = 1;

        while (Record::where('record_code', $code)
            ->whereKeyNot($record->id)
            ->exists()) {
            $code = $baseCode.'-'.$suffix;
            $suffix++;
        }

        return $code;
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
                $storedFileName .= '.'.$extension;
            }

            $filePath = $uploadedFile->storeAs(
                'records/'.$record->id,
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
                'original_name' => $uploadedFile->getClientOriginalName(),
                'stored_name' => $storedFileName,
                'file_path' => $filePath,
                'mime_type' => $uploadedFile->getMimeType(),
                'file_size' => $uploadedFile->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);

            $count++;
        }

        return $count;
    }

    private function uploadedFileRules(): array
    {
        $maxUploadKilobytes = max(
            1,
            min(
                102400,
                (int) SystemSetting::getValue(
                    'max_upload_size_mb',
                    10
                ) * 1024
            )
        );
        $allowedExtensions = array_values(array_filter(
            (array) SystemSetting::getValue(
                'allowed_extensions',
                [
                    'pdf', 'doc', 'docx', 'xls', 'xlsx',
                    'ppt', 'pptx', 'jpg', 'jpeg', 'png',
                    'txt', 'csv',
                ]
            ),
            fn ($extension) => is_string($extension)
                && preg_match('/^[a-z0-9]+$/i', $extension)
        ));

        if ($allowedExtensions === []) {
            $allowedExtensions = ['pdf'];
        }

        return [
            'file',
            'max:'.$maxUploadKilobytes,
            'mimes:'.implode(',', $allowedExtensions),
        ];
    }

    private function maxFilesPerSubmission(): int
    {
        return max(
            1,
            min(
                10,
                (int) SystemSetting::getValue(
                    'max_files_per_submission',
                    10
                )
            )
        );
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $this->roleName($request);

        if (! in_array($role, ['Admin', 'Records Officer', 'Staff'], true)) {
            return response()->json([
                'message' => 'Your account is not assigned a valid role.',
            ], 403);
        }

        $query = Record::with($this->recordRelations());

        $scope = (string) $request->query('scope', '');

        if ($scope === 'mine') {
            $query->where('created_by', $user->id);
        } elseif ($role === 'Staff') {
            $query->where(function ($query) use ($user) {
                $query->where('created_by', $user->id);

                if ($user->department_id !== null) {
                    $query->orWhere(
                        'department_id',
                        $user->department_id
                    );
                }
            });
        } elseif (! $request->filled('status')) {
            // Keep the active Records page focused on submissions and review work.
            // Archived records are managed from the dedicated Archive repository.
            $query->whereNotIn('status', [
                'archived',
                'for_disposal',
                'disposed',
            ]);
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

                if (! in_array(
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

        if (! in_array($role, ['Admin', 'Records Officer', 'Staff'], true)) {
            return response()->json([
                'message' => 'Your account is not assigned a valid role.',
            ], 403);
        }

        $maxFiles = $this->maxFilesPerSubmission();
        $requireRemarks = (bool) SystemSetting::getValue(
            'require_submission_remarks',
            false
        );

        $validated = $request->validate([
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
            'storage_location' => [
                'nullable',
                'string',
                'max:255',
            ],
            'remarks' => [
                $requireRemarks ? 'required' : 'nullable',
                'string',
                'max:5000',
            ],
            'files' => [
                'nullable',
                'array',
                'max:'.$maxFiles,
            ],
            'files.*' => $this->uploadedFileRules(),
        ], [
            'remarks.required' => 'Submission remarks are required by the current system settings.',
            'files.max' => "A submission may contain a maximum of {$maxFiles} files.",
        ]);

        if ($user->department_id === null || ! $user->department) {
            return response()->json([
                'message' => 'Your account is not assigned to a department. Ask an Administrator to update your account.',
            ], 422);
        }

        if ($role === 'Staff') {
            if (! $user->department->accepts_submissions) {
                return response()->json([
                    'message' => 'Your department is not enabled for record submissions. Ask an Administrator to update your assignment.',
                ], 422);
            }

            $validated['department_id'] = $user->department_id;
            $validated['storage_location'] = null;
        } elseif (! Department::query()
            ->whereKey($validated['department_id'])
            ->where('accepts_submissions', true)
            ->exists()) {
            return response()->json([
                'message' => 'Please select a department that accepts record submissions.',
            ], 422);
        }

        $validated['record_code'] = 'PENDING-'.Str::uuid();
        $validated['source'] = $user->department->name;
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
                $record->update([
                    'record_code' => $this->generatedRecordCode($record),
                ]);
                $uploadedCount = $this->storeFiles(
                    $request,
                    $record,
                    $storedFilePaths
                );

                $this->audit(
                    $request,
                    $record,
                    'created_record',
                    'Created record: '.$record->record_code
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

            $this->notifications->notifyManagers(
                $request->user(),
                'New record submitted',
                "{$request->user()->name} submitted {$record->record_code}: {$record->title}.",
                'record.submitted',
                '/records?status=received',
                [
                    'record_id' => $record->id,
                    'record_code' => $record->record_code,
                    'record_title' => $record->title,
                ]
            );

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
        if (! $this->canViewRecord($request, $record)) {
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

        if (! $record) {
            return response()->json([
                'message' => 'The associated record no longer exists.',
            ], 404);
        }

        if (! $this->canViewRecord($request, $record)) {
            return response()->json([
                'message' => 'You are not allowed to download this file.',
            ], 403);
        }

        if ($recordFile->purged_at) {
            return response()->json([
                'message' => 'This attachment was permanently deleted under an approved disposal certificate.',
            ], 410);
        }

        if (! Storage::disk('local')->exists(
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
            'Downloaded file: '.$recordFile->file_name
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

        if (! $record) {
            return response()->json([
                'message' => 'The associated record no longer exists.',
            ], 404);
        }

        if (! $this->userOwnsRecord($request, $record)) {
            return response()->json([
                'message' => 'You may only remove files from your own submission.',
            ], 403);
        }

        if (! in_array(
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

        DB::transaction(function () use (
            $request,
            $record
        ) {
            $record->update([
                'status' => 'under_review',
                'review_remarks' => null,
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

        $this->notifications->notifyUser(
            $record->creator,
            $request->user(),
            'Record review started',
            "Your record {$record->record_code} is now under review.",
            'record.review_started',
            '/records?scope=mine&status=under_review',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
                'record_title' => $record->title,
            ]
        );

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
                'review_remarks' => $validated['review_remarks']
                    ?? $record->review_remarks,
                'storage_location' => $validated['storage_location']
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

        $requireCorrectionNotes = (bool) SystemSetting::getValue(
            'require_correction_notes',
            true
        );

        $validated = $request->validate([
            'correction_notes' => [
                $requireCorrectionNotes ? 'required' : 'nullable',
                'string',
                'max:5000',
            ],
        ], [
            'correction_notes.required' => 'Correction notes are required before returning the submission.',
        ]);

        DB::transaction(function () use (
            $request,
            $record,
            $validated
        ) {
            $record->update([
                'status' => 'returned_for_correction',
                'correction_notes' => $validated['correction_notes'] ?? null,
                'returned_by' => $request->user()->id,
                'returned_at' => now(),
                'resubmitted_at' => null,
                'storage_location' => null,
            ]);

            $this->audit(
                $request,
                $record,
                'returned_record_for_correction',
                "Returned record {$record->record_code} for correction."
            );
        });

        $this->notifications->notifyUser(
            $record->creator,
            $request->user(),
            'Record needs correction',
            "Your record {$record->record_code} was returned for correction.",
            'record.returned_for_correction',
            '/records?scope=mine&status=returned_for_correction',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
                'record_title' => $record->title,
                'correction_notes' => $validated['correction_notes'] ?? null,
            ]
        );

        return response()->json([
            'message' => 'Record returned to the submitter for correction.',
            'record' => $record->fresh()->load(
                $this->recordRelations()
            ),
        ]);
    }

    public function saveCorrection(
        Request $request,
        Record $record
    ) {
        if (! $this->userOwnsRecord($request, $record)) {
            return response()->json([
                'message' => 'You may only correct your own returned submission.',
            ], 403);
        }

        if ($record->status !== 'returned_for_correction') {
            return response()->json([
                'message' => 'Only returned submissions can be corrected.',
            ], 422);
        }

        $maxFiles = $this->maxFilesPerSubmission();
        $requireRemarks = (bool) SystemSetting::getValue(
            'require_submission_remarks',
            false
        );

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => [
                'required',
                'exists:record_categories,id',
            ],
            'date_received' => ['required', 'date'],
            'remarks' => [
                $requireRemarks ? 'required' : 'nullable',
                'string',
                'max:5000',
            ],
            'files' => [
                'nullable',
                'array',
                'max:'.$maxFiles,
            ],
            'files.*' => $this->uploadedFileRules(),
        ], [
            'remarks.required' => 'Submission remarks are required by the current system settings.',
            'files.max' => "A submission may contain a maximum of {$maxFiles} files.",
        ]);

        $existingCount = $record->files()->count();
        $newCount = count($request->file('files', []));

        if ($existingCount + $newCount > $maxFiles) {
            return response()->json([
                'message' => "A submission may contain a maximum of {$maxFiles} files.",
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
                    'title' => $validated['title'],
                    'description' => $validated['description'] ?? null,
                    'category_id' => $validated['category_id'],
                    'department_id' => $record->department_id,
                    'date_received' => $validated['date_received'],
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
        if (! $this->userOwnsRecord($request, $record)) {
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
                'returned_by' => null,
                'returned_at' => null,
            ]);

            $this->audit(
                $request,
                $record,
                'resubmitted_record',
                "Resubmitted corrected record: {$record->record_code}"
            );
        });

        $this->notifications->notifyManagers(
            $request->user(),
            'Record resubmitted',
            "{$request->user()->name} resubmitted corrected record {$record->record_code}.",
            'record.resubmitted',
            '/records?status=received',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
                'record_title' => $record->title,
            ]
        );

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

        $requireStorageLocation = (bool) SystemSetting::getValue(
            'require_storage_location',
            true
        );

        $validated = $request->validate([
            'review_remarks' => [
                'required',
                'string',
                'max:5000',
            ],
            'storage_location' => [
                $requireStorageLocation ? 'required' : 'nullable',
                'string',
                'max:255',
            ],
            'retention_type' => [
                'sometimes',
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
        ]);

        $retentionType = $validated['retention_type'] ?? 'permanent';
        $temporary = $retentionType === 'temporary';
        $retentionUnit = $temporary
            ? ($validated['retention_unit'] ?? 'years')
            : 'years';
        $retentionYears = $temporary
            ? (int) $validated['retention_years']
            : null;

        if ($retentionUnit === 'minutes' && $retentionYears !== 1) {
            return response()->json([
                'message' => 'Practice retention must be exactly 1 minute.',
            ], 422);
        }

        $archivedAt = now();

        DB::transaction(function () use (
            $request,
            $record,
            $validated,
            $retentionType,
            $retentionUnit,
            $temporary,
            $retentionYears,
            $archivedAt
        ) {
            $record->update([
                'status' => 'archived',
                'review_remarks' => $validated['review_remarks'],
                'storage_location' => $validated['storage_location'] ?? null,
                'archived_by' => $request->user()->id,
                'archived_at' => $archivedAt,
                'retention_type' => $retentionType,
                'retention_years' => $retentionYears,
                'retention_unit' => $retentionUnit,
                'retention_expires_at' => $temporary
                    ? ($retentionUnit === 'minutes'
                        ? $archivedAt->copy()->addMinute()
                        : $archivedAt->copy()->addYears($retentionYears))
                    : null,

                // Freshly archived records are visible in the
                // Staff Archive Catalog by default.
                'staff_visible' => true,
                'access_level' => 'internal',
            ]);

            $this->audit(
                $request,
                $record,
                'archived_record',
                "Archived record: {$record->record_code}"
            );
        });

        $this->notifications->notifyUser(
            $record->creator,
            $request->user(),
            'Record archived',
            "Your record {$record->record_code} was approved and archived.",
            'record.archived',
            '/records?scope=mine&status=archived',
            [
                'record_id' => $record->id,
                'record_code' => $record->record_code,
                'record_title' => $record->title,
                'review_remarks' => $validated['review_remarks'],
            ]
        );

        return response()->json([
            'message' => 'Record archived successfully.',
            'record' => $record->fresh()->load(
                $this->recordRelations()
            ),
        ]);
    }

    public function update(Request $request, Record $record)
    {
        if (! $this->userOwnsRecord($request, $record)) {
            return response()->json([
                'message' => 'You may only update records submitted by your account.',
            ], 403);
        }

        if (! in_array(
            $record->status,
            ['received', 'returned_for_correction'],
            true
        )) {
            return response()->json([
                'message' => 'This submission cannot be edited while it is under review or archived.',
            ], 403);
        }

        $validated = $request->validate([
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
        if (! $this->canManageRecords($request)) {
            return response()->json([
                'message' => 'You are not allowed to delete records.',
            ], 403);
        }

        if (
            $record->status === 'archived'
            && (bool) SystemSetting::getValue(
                'lock_archived_records',
                true
            )
        ) {
            return response()->json([
                'message' => 'Archived records are locked by the current system settings. Use the authorized disposal workflow instead.',
            ], 422);
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
                    'Deleted record: '.$recordCode
                );

                $record->delete();
            });

            Storage::disk('local')->deleteDirectory(
                'records/'.$recordId
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
