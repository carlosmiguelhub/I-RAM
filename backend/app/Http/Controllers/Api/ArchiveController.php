<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArchiveFolder;
use App\Models\AuditLog;
use App\Models\Record;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ArchiveController extends Controller
{
    private function roleName(Request $request): string
    {
        return $request->user()->role?->name ?? '';
    }

    private function denyArchiveAccess(Request $request)
    {
        if (!in_array(
            $this->roleName($request),
            ['Admin', 'Records Officer'],
            true
        )) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may access the archive repository.',
            ], 403);
        }

        return null;
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

    private function logFolderAction(
        Request $request,
        string $action,
        string $description
    ): void {
        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => null,
            'action' => $action,
            'description' => $description,
            'ip_address' => $request->ip(),
        ]);
    }

    public function index(Request $request)
    {
        if ($response = $this->denyArchiveAccess($request)) {
            return $response;
        }

        $query = Record::with($this->recordRelations())
            ->where('status', 'archived');

        if ($request->filled('folder_id')) {
            if ($request->folder_id === 'unfiled') {
                $query->whereNull('archive_folder_id');
            } else {
                $query->where(
                    'archive_folder_id',
                    $request->folder_id
                );
            }
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

        if ($request->filled('department_id')) {
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

        if ($request->filled('staff_visible')) {
            $query->where(
                'staff_visible',
                $request->boolean('staff_visible')
            );
        }

        if ($request->filled('access_level')) {
            $request->validate([
                'access_level' => [
                    Rule::in([
                        'internal',
                        'confidential',
                    ]),
                ],
            ]);

            $query->where(
                'access_level',
                $request->access_level
            );
        }

        return response()->json(
            $query->latest('archived_at')->paginate(12)
        );
    }

    public function folders(Request $request)
    {
        if ($response = $this->denyArchiveAccess($request)) {
            return $response;
        }

        $folders = ArchiveFolder::query()
            ->with('creator:id,name')
            ->withCount([
                'records as records_count' => function ($query) {
                    $query->where('status', 'archived');
                },
            ])
            ->orderBy('name')
            ->get();

        $unfiledCount = Record::query()
            ->where('status', 'archived')
            ->whereNull('archive_folder_id')
            ->count();

        return response()->json([
            'folders' => $folders,
            'unfiled_count' => $unfiledCount,
        ]);
    }

    public function storeFolder(Request $request)
    {
        if ($response = $this->denyArchiveAccess($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                'unique:archive_folders,name',
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $folder = ArchiveFolder::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        $this->logFolderAction(
            $request,
            'created_archive_folder',
            'Created archive folder: ' . $folder->name
        );

        return response()->json([
            'message' => 'Archive folder created successfully.',
            'folder' => $folder
                ->load('creator:id,name')
                ->loadCount('records'),
        ], 201);
    }

    public function updateFolder(
        Request $request,
        ArchiveFolder $archiveFolder
    ) {
        if ($response = $this->denyArchiveAccess($request)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('archive_folders', 'name')
                    ->ignore($archiveFolder->id),
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ]);

        $oldName = $archiveFolder->name;

        $archiveFolder->update($validated);

        $this->logFolderAction(
            $request,
            'updated_archive_folder',
            "Updated archive folder {$oldName} to {$archiveFolder->name}"
        );

        return response()->json([
            'message' => 'Archive folder updated successfully.',
            'folder' => $archiveFolder
                ->fresh()
                ->load('creator:id,name')
                ->loadCount('records'),
        ]);
    }

    public function destroyFolder(
        Request $request,
        ArchiveFolder $archiveFolder
    ) {
        if ($response = $this->denyArchiveAccess($request)) {
            return $response;
        }

        $folderName = $archiveFolder->name;

        $recordsCount = $archiveFolder
            ->records()
            ->where('status', 'archived')
            ->count();

        DB::transaction(function () use ($archiveFolder) {
            $archiveFolder->records()->update([
                'archive_folder_id' => null,
            ]);

            $archiveFolder->delete();
        });

        $this->logFolderAction(
            $request,
            'deleted_archive_folder',
            "Deleted archive folder {$folderName}; {$recordsCount} record(s) moved to Unfiled"
        );

        return response()->json([
            'message' => $recordsCount > 0
                ? 'Folder deleted. Its archived records were moved to Unfiled.'
                : 'Archive folder deleted successfully.',
        ]);
    }

    public function moveRecord(
        Request $request,
        Record $record
    ) {
        if ($response = $this->denyArchiveAccess($request)) {
            return $response;
        }

        if ($record->status !== 'archived') {
            return response()->json([
                'message' => 'Only archived records can be moved into archive folders.',
            ], 422);
        }

        $validated = $request->validate([
            'archive_folder_id' => [
                'nullable',
                'integer',
                'exists:archive_folders,id',
            ],
        ]);

        $oldFolder = $record->archiveFolder?->name ?? 'Unfiled';
        $newFolderId = $validated['archive_folder_id'] ?? null;

        $record->update([
            'archive_folder_id' => $newFolderId,
        ]);

        $record->load('archiveFolder');

        $newFolder = $record->archiveFolder?->name ?? 'Unfiled';

        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => 'moved_archived_record',
            'description' => "Moved archived record {$record->record_code} from {$oldFolder} to {$newFolder}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Archived record moved successfully.',
            'record' => $record
                ->fresh()
                ->load($this->recordRelations()),
        ]);
    }

    public function updateStaffAccess(
        Request $request,
        Record $record
    ) {
        if ($response = $this->denyArchiveAccess($request)) {
            return $response;
        }

        if ($record->status !== 'archived') {
            return response()->json([
                'message' => 'Staff access settings can only be changed for archived records.',
            ], 422);
        }

        $validated = $request->validate([
            'staff_visible' => [
                'required',
                'boolean',
            ],
            'access_level' => [
                'required',
                Rule::in([
                    'internal',
                    'confidential',
                ]),
            ],
        ]);

        $accessLevel = $validated['access_level'];

        /*
         * Internal records are always visible in the Staff Archive
         * Catalog. Confidential records are always hidden.
         */
        $staffVisible = $accessLevel === 'internal';

        $oldVisible = (bool) $record->staff_visible;
        $oldAccessLevel = $record->access_level ?? 'internal';

        $record->update([
            'staff_visible' => $staffVisible,
            'access_level' => $accessLevel,
        ]);

        $visibilityLabel = $staffVisible
            ? 'visible to staff'
            : 'hidden from staff';

        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => 'updated_archive_staff_access',
            'description' => sprintf(
                'Updated staff access for %s from %s/%s to %s/%s',
                $record->record_code,
                $oldVisible ? 'visible' : 'hidden',
                $oldAccessLevel,
                $staffVisible ? 'visible' : 'hidden',
                $accessLevel
            ),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => "Access settings updated. This record is now {$visibilityLabel}.",
            'record' => $record
                ->fresh()
                ->load($this->recordRelations()),
        ]);
    }
}