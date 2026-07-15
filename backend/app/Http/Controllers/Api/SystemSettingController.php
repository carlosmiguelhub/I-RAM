<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Throwable;

class SystemSettingController extends Controller
{
    public function index(): JsonResponse
    {
        $settings = SystemSetting::query()
            ->orderBy('group')
            ->orderBy('key')
            ->get()
            ->groupBy('group')
            ->map(function ($groupSettings) {
                return $groupSettings->mapWithKeys(function ($setting) {
                    return [
                        $setting->key => $setting->typed_value,
                    ];
                });
            });

        return response()->json([
            'settings' => $settings,
        ]);
    }

    public function publicSettings(): JsonResponse
    {
        $settings = SystemSetting::query()
            ->where('is_public', true)
            ->orderBy('group')
            ->orderBy('key')
            ->get()
            ->groupBy('group')
            ->map(function ($groupSettings) {
                return $groupSettings->mapWithKeys(function ($setting) {
                    return [
                        $setting->key => $setting->typed_value,
                    ];
                });
            });

        return response()->json([
            'settings' => $settings,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'general' => ['required', 'array'],
            'general.system_name' => [
                'required',
                'string',
                'max:100',
            ],
            'general.organization_name' => [
                'required',
                'string',
                'max:255',
            ],
            'general.contact_email' => [
                'nullable',
                'email',
                'max:255',
            ],
            'general.timezone' => [
                'required',
                'string',
                'max:100',
            ],
            'general.date_format' => [
                'required',
                'string',
                'max:50',
            ],

            'records' => ['required', 'array'],
            'records.record_code_prefix' => [
                'required',
                'string',
                'max:20',
                'regex:/^[A-Za-z0-9_-]+$/',
            ],
            'records.require_storage_location' => [
                'required',
                'boolean',
            ],
            'records.require_submission_remarks' => [
                'required',
                'boolean',
            ],

            'workflow' => ['required', 'array'],
            'workflow.require_records_officer_review' => [
                'required',
                'boolean',
            ],
            'workflow.allow_admin_review' => [
                'required',
                'boolean',
            ],
            'workflow.require_correction_notes' => [
                'required',
                'boolean',
            ],
            'workflow.lock_archived_records' => [
                'required',
                'boolean',
            ],

            'files' => ['required', 'array'],
            'files.max_upload_size_mb' => [
                'required',
                'integer',
                'min:1',
                'max:100',
            ],
            'files.max_files_per_submission' => [
                'required',
                'integer',
                'min:1',
                'max:50',
            ],
            'files.allowed_extensions' => [
                'required',
                'array',
                'min:1',
            ],
            'files.allowed_extensions.*' => [
                'required',
                'string',
                Rule::in([
                    'pdf',
                    'doc',
                    'docx',
                    'xls',
                    'xlsx',
                    'jpg',
                    'jpeg',
                    'png',
                ]),
            ],

            'security' => ['required', 'array'],
            'security.allow_registration' => [
                'required',
                'boolean',
            ],
            'security.default_registered_role' => [
                'required',
                Rule::in(['Staff']),
            ],
            'security.session_timeout_minutes' => [
                'required',
                'integer',
                'min:15',
                'max:1440',
            ],
            'security.login_attempt_limit' => [
                'required',
                'integer',
                'min:3',
                'max:20',
            ],
        ]);

        $definitions = $this->definitions();

        $changes = [];

        DB::transaction(function () use (
            $validated,
            $definitions,
            &$changes
        ) {
            foreach ($definitions as $group => $settings) {
                foreach ($settings as $key => $definition) {
                    $newValue = data_get(
                        $validated,
                        "{$group}.{$key}"
                    );

                    $existing = SystemSetting::where(
                        'key',
                        $key
                    )->first();

                    $oldValue = $existing
                        ? $existing->typed_value
                        : null;

                    if ($oldValue !== $newValue) {
                        $changes[$key] = [
                            'old' => $oldValue,
                            'new' => $newValue,
                        ];
                    }

                    SystemSetting::setValue(
                        $group,
                        $key,
                        $newValue,
                        $definition['type'],
                        $definition['is_public']
                    );
                }
            }
        });

        if (! empty($changes)) {
            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'settings.updated',
                'description' => $this->buildAuditDescription(
                    $changes
                ),
                'ip_address' => $request->ip(),
            ]);
        }

        return response()->json([
            'message' => empty($changes)
                ? 'No settings changes were detected.'
                : 'System settings updated successfully.',
            'changes' => $changes,
        ]);
    }

    /**
     * Temporary local-development endpoint.
     * Remove this method and its route before production deployment.
     */
    public function practiceDataSummary(): JsonResponse
    {
        if (! $this->developmentToolsEnabled()) {
            return response()->json([
                'message' => 'Development tools are disabled in this environment.',
            ], 403);
        }

        return response()->json([
            'enabled' => true,
            'counts' => [
                'records' => DB::table('records')->count(),
                'record_files' => DB::table('record_files')->count(),
                'document_requests' => DB::table('document_requests')->count(),
                'archive_folders' => DB::table('archive_folders')->count(),
                'notifications' => DB::table('notifications')->count(),
                'related_audit_logs' => DB::table('audit_logs')
                    ->whereIn('action', $this->practiceAuditActions())
                    ->count(),
            ],
        ]);
    }

    /**
     * Temporary local-development endpoint.
     * Deletes practice submissions while preserving users, roles,
     * departments, categories, and system settings.
     */
    public function clearPracticeData(Request $request): JsonResponse
    {
        if (! $this->developmentToolsEnabled()) {
            return response()->json([
                'message' => 'Development tools are disabled in this environment.',
            ], 403);
        }

        $validated = $request->validate([
            'confirmation' => [
                'required',
                'string',
                Rule::in(['CLEAR PRACTICE DATA']),
            ],
            'password' => ['required', 'string'],
            'clear_archive_folders' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'The administrator password is incorrect.',
                'errors' => [
                    'password' => [
                        'The administrator password is incorrect.',
                    ],
                ],
            ], 422);
        }

        $clearArchiveFolders = (bool) (
            $validated['clear_archive_folders'] ?? false
        );

        $filePaths = DB::table('record_files')
            ->whereNotNull('file_path')
            ->pluck('file_path')
            ->filter()
            ->unique()
            ->values();

        $deleted = [
            'records' => 0,
            'record_files' => 0,
            'document_requests' => 0,
            'archive_folders' => 0,
            'notifications' => 0,
            'related_audit_logs' => 0,
            'physical_files' => 0,
            'physical_file_failures' => 0,
        ];

        DB::transaction(function () use (
            $clearArchiveFolders,
            &$deleted
        ) {
            $deleted['notifications'] = DB::table(
                'notifications'
            )->delete();

            $deleted['document_requests'] = DB::table(
                'document_requests'
            )->delete();

            $deleted['record_files'] = DB::table(
                'record_files'
            )->delete();

            $deleted['records'] = DB::table(
                'records'
            )->delete();

            if ($clearArchiveFolders) {
                $deleted['archive_folders'] = DB::table(
                    'archive_folders'
                )->delete();
            }

            $deleted['related_audit_logs'] = DB::table(
                'audit_logs'
            )
                ->whereIn('action', $this->practiceAuditActions())
                ->delete();

            $this->resetPracticeAutoIncrement(
                $clearArchiveFolders
            );
        });

        foreach ($filePaths as $filePath) {
            try {
                if ($this->deleteStoredRecordFile((string) $filePath)) {
                    $deleted['physical_files']++;
                }
            } catch (Throwable) {
                $deleted['physical_file_failures']++;
            }
        }

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'development.practice_data_cleared',
            'description' => sprintf(
                'Cleared practice data: %d records, %d files, %d requests%s.',
                $deleted['records'],
                $deleted['record_files'],
                $deleted['document_requests'],
                $clearArchiveFolders
                    ? sprintf(
                        ', and %d archive folders',
                        $deleted['archive_folders']
                    )
                    : ''
            ),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => $deleted['physical_file_failures'] > 0
                ? 'Practice data was cleared, but some physical files could not be removed.'
                : 'Practice data cleared successfully.',
            'deleted' => $deleted,
        ]);
    }

    private function developmentToolsEnabled(): bool
    {
        return app()->environment([
            'local',
            'development',
            'testing',
        ]);
    }

    private function practiceAuditActions(): array
    {
        return [
            'created_record',
            'uploaded_record_files',
            'started_review',
            'returned_for_correction',
            'resubmitted_record',
            'archived_record',
            'downloaded_record_file',
            'deleted_record_file',
            'created_archive_folder',
            'updated_archive_folder',
            'deleted_archive_folder',
            'moved_archived_record',
            'document_request_created',
            'document_request_started_review',
            'document_request_approved',
            'document_request_rejected',
            'document_request_released',
            'document_request_cancelled',
            'record.created',
            'record.files_uploaded',
            'record.review_started',
            'record.returned_for_correction',
            'record.resubmitted',
            'record.archived',
            'record_file.downloaded',
            'record_file.deleted',
            'archive_folder.created',
            'archive_folder.updated',
            'archive_folder.deleted',
            'archive_record.moved',
            'document_request.created',
            'document_request.review_started',
            'document_request.approved',
            'document_request.rejected',
            'document_request.released',
            'document_request.cancelled',
        ];
    }

    private function resetPracticeAutoIncrement(
        bool $clearArchiveFolders
    ): void {
        DB::statement(
            'ALTER TABLE document_requests AUTO_INCREMENT = 1'
        );
        DB::statement(
            'ALTER TABLE record_files AUTO_INCREMENT = 1'
        );
        DB::statement(
            'ALTER TABLE records AUTO_INCREMENT = 1'
        );

        if ($clearArchiveFolders) {
            DB::statement(
                'ALTER TABLE archive_folders AUTO_INCREMENT = 1'
            );
        }
    }

    private function deleteStoredRecordFile(
        string $filePath
    ): bool {
        $normalized = str_replace('\\', '/', trim($filePath));
        $normalized = ltrim($normalized, '/');

        $candidates = array_values(array_unique(array_filter([
            $normalized,
            preg_replace('#^storage/#', '', $normalized),
            preg_replace('#^public/#', '', $normalized),
        ])));

        foreach ($candidates as $candidate) {
            if (Storage::disk('public')->exists($candidate)) {
                return Storage::disk('public')->delete($candidate);
            }

            if (Storage::disk('local')->exists($candidate)) {
                return Storage::disk('local')->delete($candidate);
            }
        }

        return false;
    }

    private function definitions(): array
    {
        return [
            'general' => [
                'system_name' => [
                    'type' => 'string',
                    'is_public' => true,
                ],
                'organization_name' => [
                    'type' => 'string',
                    'is_public' => true,
                ],
                'contact_email' => [
                    'type' => 'string',
                    'is_public' => true,
                ],
                'timezone' => [
                    'type' => 'string',
                    'is_public' => false,
                ],
                'date_format' => [
                    'type' => 'string',
                    'is_public' => false,
                ],
            ],

            'records' => [
                'record_code_prefix' => [
                    'type' => 'string',
                    'is_public' => false,
                ],
                'require_storage_location' => [
                    'type' => 'boolean',
                    'is_public' => false,
                ],
                'require_submission_remarks' => [
                    'type' => 'boolean',
                    'is_public' => false,
                ],
            ],

            'workflow' => [
                'require_records_officer_review' => [
                    'type' => 'boolean',
                    'is_public' => false,
                ],
                'allow_admin_review' => [
                    'type' => 'boolean',
                    'is_public' => false,
                ],
                'require_correction_notes' => [
                    'type' => 'boolean',
                    'is_public' => false,
                ],
                'lock_archived_records' => [
                    'type' => 'boolean',
                    'is_public' => false,
                ],
            ],

            'files' => [
                'max_upload_size_mb' => [
                    'type' => 'integer',
                    'is_public' => false,
                ],
                'max_files_per_submission' => [
                    'type' => 'integer',
                    'is_public' => false,
                ],
                'allowed_extensions' => [
                    'type' => 'array',
                    'is_public' => false,
                ],
            ],

            'security' => [
                'allow_registration' => [
                    'type' => 'boolean',
                    'is_public' => true,
                ],
                'default_registered_role' => [
                    'type' => 'string',
                    'is_public' => false,
                ],
                'session_timeout_minutes' => [
                    'type' => 'integer',
                    'is_public' => false,
                ],
                'login_attempt_limit' => [
                    'type' => 'integer',
                    'is_public' => false,
                ],
            ],
        ];
    }

    private function buildAuditDescription(
        array $changes
    ): string {
        $changedKeys = array_keys($changes);

        return sprintf(
            'Updated system settings: %s.',
            implode(', ', $changedKeys)
        );
    }
}
