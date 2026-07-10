<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            [
                'group' => 'general',
                'key' => 'system_name',
                'value' => 'IRAM',
                'type' => 'string',
                'is_public' => true,
            ],
            [
                'group' => 'general',
                'key' => 'organization_name',
                'value' => 'Record Acquisition and Archiving Management System',
                'type' => 'string',
                'is_public' => true,
            ],
            [
                'group' => 'general',
                'key' => 'contact_email',
                'value' => '',
                'type' => 'string',
                'is_public' => true,
            ],
            [
                'group' => 'general',
                'key' => 'timezone',
                'value' => 'Asia/Manila',
                'type' => 'string',
                'is_public' => false,
            ],
            [
                'group' => 'general',
                'key' => 'date_format',
                'value' => 'M d, Y',
                'type' => 'string',
                'is_public' => false,
            ],

            [
                'group' => 'records',
                'key' => 'record_code_prefix',
                'value' => 'IRAM',
                'type' => 'string',
                'is_public' => false,
            ],
            [
                'group' => 'records',
                'key' => 'require_storage_location',
                'value' => 'true',
                'type' => 'boolean',
                'is_public' => false,
            ],
            [
                'group' => 'records',
                'key' => 'require_submission_remarks',
                'value' => 'false',
                'type' => 'boolean',
                'is_public' => false,
            ],

            [
                'group' => 'workflow',
                'key' => 'require_records_officer_review',
                'value' => 'true',
                'type' => 'boolean',
                'is_public' => false,
            ],
            [
                'group' => 'workflow',
                'key' => 'allow_admin_review',
                'value' => 'true',
                'type' => 'boolean',
                'is_public' => false,
            ],
            [
                'group' => 'workflow',
                'key' => 'require_correction_notes',
                'value' => 'true',
                'type' => 'boolean',
                'is_public' => false,
            ],
            [
                'group' => 'workflow',
                'key' => 'lock_archived_records',
                'value' => 'true',
                'type' => 'boolean',
                'is_public' => false,
            ],

            [
                'group' => 'files',
                'key' => 'max_upload_size_mb',
                'value' => '25',
                'type' => 'integer',
                'is_public' => false,
            ],
            [
                'group' => 'files',
                'key' => 'max_files_per_submission',
                'value' => '10',
                'type' => 'integer',
                'is_public' => false,
            ],
            [
                'group' => 'files',
                'key' => 'allowed_extensions',
                'value' => json_encode([
                    'pdf',
                    'doc',
                    'docx',
                    'xls',
                    'xlsx',
                    'jpg',
                    'jpeg',
                    'png',
                ]),
                'type' => 'array',
                'is_public' => false,
            ],

            [
                'group' => 'security',
                'key' => 'allow_registration',
                'value' => 'true',
                'type' => 'boolean',
                'is_public' => true,
            ],
            [
                'group' => 'security',
                'key' => 'default_registered_role',
                'value' => 'Staff',
                'type' => 'string',
                'is_public' => false,
            ],
            [
                'group' => 'security',
                'key' => 'session_timeout_minutes',
                'value' => '120',
                'type' => 'integer',
                'is_public' => false,
            ],
            [
                'group' => 'security',
                'key' => 'login_attempt_limit',
                'value' => '5',
                'type' => 'integer',
                'is_public' => false,
            ],
        ];

        foreach ($settings as $setting) {
            SystemSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}