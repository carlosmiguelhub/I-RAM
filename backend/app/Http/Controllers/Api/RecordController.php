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

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Record::with([
            'category',
            'department',
            'creator',
            'files',
        ]);

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

        $records = $query
            ->latest()
            ->paginate(10);

        return response()->json($records);
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
            'title' => [
                'required',
                'string',
                'max:255',
            ],
            'description' => [
                'nullable',
                'string',
            ],
            'category_id' => [
                'required',
                'exists:record_categories,id',
            ],
            'department_id' => [
                'required',
                'exists:departments,id',
            ],
            'date_received' => [
                'required',
                'date',
            ],
            'source' => [
                'nullable',
                'string',
                'max:255',
            ],
            'status' => [
                'nullable',
                'in:received,under_review,archived,for_disposal,disposed',
            ],
            'storage_location' => [
                'nullable',
                'string',
                'max:255',
            ],
            'remarks' => [
                'nullable',
                'string',
            ],
            'files' => [
                'nullable',
                'array',
                'max:5',
            ],
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
            $validated['status'] = 'received';
            $validated['storage_location'] = null;
        } else {
            $validated['status'] =
                $validated['status'] ?? 'received';
        }

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

                foreach (
                    $request->file('files', [])
                    as $uploadedFile
                ) {
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
                        'file_type' => $uploadedFile
                            ->getMimeType(),
                        'file_size' => $uploadedFile
                            ->getSize(),
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
                'record' => $record->load([
                    'category',
                    'department',
                    'creator',
                    'files',
                ]),
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

    public function show(
        Request $request,
        Record $record
    ) {
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
                'category',
                'department',
                'creator',
                'files',
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

    public function update(
        Request $request,
        Record $record
    ) {
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

            /*
             * Staff can edit only while the submission is still being
             * processed. Archived records remain view/download-only.
             */
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

        $rules = [
            'record_code' => [
                'required',
                'string',
                'max:255',
                'unique:records,record_code,' . $record->id,
            ],
            'title' => [
                'required',
                'string',
                'max:255',
            ],
            'description' => [
                'nullable',
                'string',
            ],
            'category_id' => [
                'required',
                'exists:record_categories,id',
            ],
            'department_id' => [
                'required',
                'exists:departments,id',
            ],
            'date_received' => [
                'required',
                'date',
            ],
            'source' => [
                'nullable',
                'string',
                'max:255',
            ],
            'storage_location' => [
                'nullable',
                'string',
                'max:255',
            ],
            'remarks' => [
                'nullable',
                'string',
            ],
        ];

        if ($this->canManageRecords($request)) {
            $rules['status'] = [
                'required',
                'in:received,under_review,archived,for_disposal,disposed',
            ];
        }

        $validated = $request->validate($rules);

        if ($this->roleName($request) === 'Staff') {
            if ($request->user()->department_id === null) {
                return response()->json([
                    'message' => 'Your account is not assigned to a department.',
                ], 422);
            }

            $validated['department_id'] =
                $request->user()->department_id;

            $validated['status'] = $record->status;

            $validated['storage_location'] =
                $record->storage_location;
        }

        $oldStatus = $record->status;

        $record->update($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => 'updated_record',
            'description' => $oldStatus !== $record->status
                ? 'Updated record and changed status from '
                    . $oldStatus
                    . ' to '
                    . $record->status
                : 'Updated record: '
                    . $record->record_code,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Record updated successfully.',
            'record' => $record->load([
                'category',
                'department',
                'creator',
                'files',
            ]),
        ]);
    }

    public function destroy(
        Request $request,
        Record $record
    ) {
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