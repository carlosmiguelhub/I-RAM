<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
                Rule::in([
                    'Staff',
                    'Records Officer',
                    'Admin',
                ]),
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

        if (!empty($changes)) {
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