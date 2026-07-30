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

    public function clientSettings(): JsonResponse
    {
        $allowedKeys = [
            'system_name',
            'organization_name',
            'contact_email',
            'record_code_prefix',
            'require_storage_location',
            'require_submission_remarks',
            'allow_admin_review',
            'require_correction_notes',
            'lock_archived_records',
            'disposal_grace_days',
            'max_upload_size_mb',
            'max_files_per_submission',
            'allowed_extensions',
        ];

        $settings = SystemSetting::query()
            ->whereIn('key', $allowedKeys)
            ->get()
            ->groupBy('group')
            ->map(fn ($groupSettings) => $groupSettings->mapWithKeys(
                fn ($setting) => [
                    $setting->key => $setting->typed_value,
                ]
            ));

        return response()->json(['settings' => $settings]);
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
            'workflow.disposal_grace_days' => [
                'required',
                'integer',
                'min:1',
                'max:365',
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
                'max:10',
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
                    'ppt',
                    'pptx',
                    'txt',
                    'csv',
                ]),
            ],

            'security' => ['required', 'array'],
            'security.allow_registration' => [
                'required',
                'boolean',
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
                'for_disposal_records' => DB::table('records')
                    ->where('status', 'for_disposal')
                    ->count(),
                'disposed_records' => DB::table('records')
                    ->where('status', 'disposed')
                    ->count(),
                'record_files' => DB::table('record_files')->count(),
                'purged_file_metadata' => DB::table('record_files')
                    ->whereNotNull('purged_at')
                    ->count(),
                'disposal_cases' => DB::table('disposal_cases')->count(),
                'disposal_certificates' => DB::table('disposal_cases')
                    ->whereNotNull('certificate_number')
                    ->count(),
                'document_requests' => DB::table('document_requests')->count(),
                'archive_folders' => DB::table('archive_folders')->count(),
                'notifications' => DB::table('notifications')->count(),
                'audit_logs' => DB::table('audit_logs')->count(),
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
                Rule::in(['RESET PRACTICE WORKSPACE']),
            ],
            'password' => ['required', 'string'],
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

        $clearArchiveFolders = true;

        $filePaths = DB::table('record_files')
            ->whereNotNull('file_path')
            ->pluck('file_path')
            ->filter()
            ->unique()
            ->values();

        $deleted = [
            'records' => 0,
            'for_disposal_records' => DB::table('records')
                ->where('status', 'for_disposal')
                ->count(),
            'disposed_records' => DB::table('records')
                ->where('status', 'disposed')
                ->count(),
            'record_files' => 0,
            'purged_file_metadata' => DB::table('record_files')
                ->whereNotNull('purged_at')
                ->count(),
            'disposal_cases' => 0,
            'disposal_certificates' => DB::table('disposal_cases')
                ->whereNotNull('certificate_number')
                ->count(),
            'document_requests' => 0,
            'archive_folders' => 0,
            'notifications' => 0,
            'audit_logs' => 0,
            'physical_files' => 0,
            'orphaned_physical_files' => 0,
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

            $deleted['disposal_cases'] = DB::table(
                'disposal_cases'
            )->delete();

            $deleted['record_files'] = DB::table(
                'record_files'
            )->delete();

            $deleted['records'] = DB::table(
                'records'
            )->delete();

            if ($clearArchiveFolders) {
                // Detach the self-referencing hierarchy first. MySQL
                // otherwise blocks a bulk delete while child folders still
                // reference their parents.
                DB::table('archive_folders')
                    ->whereNotNull('parent_id')
                    ->update(['parent_id' => null]);

                $deleted['archive_folders'] = DB::table(
                    'archive_folders'
                )->delete();
            }

            $deleted['audit_logs'] = DB::table(
                'audit_logs'
            )->delete();

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

        /*
         * A practice reset owns the complete private records directory.
         * Sweep it after deleting database-tracked paths so files left by
         * interrupted uploads or older cleanup runs cannot become orphans.
         */
        try {
            $orphanedFiles = Storage::disk('local')
                ->allFiles('records');
            $orphanedCount = count($orphanedFiles);

            if ($orphanedCount > 0) {
                if (Storage::disk('local')->deleteDirectory('records')) {
                    $deleted['physical_files'] += $orphanedCount;
                    $deleted['orphaned_physical_files'] = $orphanedCount;
                } else {
                    $deleted['physical_file_failures'] += $orphanedCount;
                }
            } else {
                Storage::disk('local')->deleteDirectory('records');
            }

            Storage::disk('local')->makeDirectory('records');
        } catch (Throwable) {
            $deleted['physical_file_failures']++;
        }

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

    private function resetPracticeAutoIncrement(
        bool $clearArchiveFolders
    ): void {
        if (! in_array(
            DB::connection()->getDriverName(),
            ['mysql', 'mariadb'],
            true
        )) {
            return;
        }

        DB::statement(
            'ALTER TABLE document_requests AUTO_INCREMENT = 1'
        );
        DB::statement(
            'ALTER TABLE record_files AUTO_INCREMENT = 1'
        );
        DB::statement(
            'ALTER TABLE disposal_cases AUTO_INCREMENT = 1'
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
                'disposal_grace_days' => [
                    'type' => 'integer',
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
