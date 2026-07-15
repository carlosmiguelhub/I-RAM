<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\DocumentRequest;
use App\Models\Record;
use App\Models\RecordCategory;
use App\Models\RecordFile;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CriticalWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_record_submission_persists_an_attachment_using_the_real_schema(): void
    {
        Storage::fake('local');

        [$staff, $department, $category] = $this->staffContext();
        Sanctum::actingAs($staff);

        $response = $this->post('/api/records', [
            'record_code' => 'REC-001',
            'title' => 'Attachment test',
            'description' => 'Verifies record file persistence.',
            'category_id' => $category->id,
            'department_id' => $department->id,
            'date_received' => now()->toDateString(),
            'source' => 'Feature test',
            'files' => [
                UploadedFile::fake()->create(
                    'evidence.pdf',
                    100,
                    'application/pdf'
                ),
            ],
        ], ['Accept' => 'application/json']);

        $response
            ->assertCreated()
            ->assertJsonPath(
                'record.files.0.file_name',
                'evidence.pdf'
            );

        $file = RecordFile::firstOrFail();

        $this->assertSame('evidence.pdf', $file->original_name);
        $this->assertNotSame('', $file->stored_name);
        $this->assertSame('application/pdf', $file->mime_type);
        Storage::disk('local')->assertExists($file->file_path);
    }

    public function test_archived_file_download_requires_active_approved_access(): void
    {
        Storage::fake('local');

        [$staff] = $this->staffContext();
        $otherDepartment = Department::create([
            'name' => 'Other Department',
        ]);
        $category = RecordCategory::firstOrFail();
        $owner = $this->staffUser($otherDepartment);
        $record = $this->archivedRecord(
            $owner,
            $otherDepartment,
            $category
        );
        $file = $this->recordFile($record, $owner);

        Sanctum::actingAs($staff);

        $this->getJson("/api/record-files/{$file->id}/download")
            ->assertForbidden();

        DocumentRequest::create([
            'record_id' => $record->id,
            'requested_by' => $staff->id,
            'purpose' => 'Official reference',
            'urgency' => 'normal',
            'preferred_format' => 'digital',
            'status' => 'approved',
            'approved_at' => now(),
            'expires_at' => now()->addHour(),
        ]);

        $this->getJson('/api/document-requests')
            ->assertOk()
            ->assertJsonPath(
                'data.0.record.files.0.file_name',
                'document.pdf'
            );

        $this->get("/api/record-files/{$file->id}/download")
            ->assertOk();
    }

    public function test_expired_or_confidential_document_access_is_denied(): void
    {
        Storage::fake('local');

        [$staff, $department, $category] = $this->staffContext();
        $owner = $this->staffUser($department);
        $record = $this->archivedRecord(
            $owner,
            $department,
            $category
        );
        $file = $this->recordFile($record, $owner);

        DocumentRequest::create([
            'record_id' => $record->id,
            'requested_by' => $staff->id,
            'purpose' => 'Expired access',
            'urgency' => 'normal',
            'preferred_format' => 'digital',
            'status' => 'approved',
            'approved_at' => now()->subHours(2),
            'expires_at' => now()->subHour(),
        ]);

        Sanctum::actingAs($staff);

        $this->getJson('/api/document-requests')
            ->assertOk()
            ->assertJsonMissingPath('data.0.record.files');

        $this->getJson("/api/record-files/{$file->id}/download")
            ->assertForbidden();

        $record->update([
            'access_level' => 'confidential',
            'staff_visible' => false,
        ]);

        $this->getJson("/api/record-files/{$file->id}/download")
            ->assertForbidden();
    }

    public function test_public_registration_can_be_disabled(): void
    {
        $this->staffContext();
        SystemSetting::setValue(
            'security',
            'allow_registration',
            false,
            'boolean',
            true
        );

        $this->postJson('/api/register', $this->registrationPayload())
            ->assertForbidden();

        $this->assertDatabaseMissing('users', [
            'email' => 'new.staff@example.test',
        ]);
    }

    public function test_public_registration_always_creates_a_staff_account(): void
    {
        [, $department] = $this->staffContext();
        Role::create(['name' => 'Admin']);
        SystemSetting::setValue(
            'security',
            'allow_registration',
            true,
            'boolean',
            true
        );
        SystemSetting::setValue(
            'security',
            'default_registered_role',
            'Admin'
        );

        $payload = $this->registrationPayload();
        $payload['department_id'] = $department->id;

        $this->postJson('/api/register', $payload)
            ->assertCreated()
            ->assertJsonPath('user.role.name', 'Staff');
    }

    public function test_login_attempt_setting_is_enforced(): void
    {
        [$staff] = $this->staffContext();
        RateLimiter::clear(
            strtolower($staff->email).'|127.0.0.1'
        );
        SystemSetting::setValue(
            'security',
            'login_attempt_limit',
            2,
            'integer'
        );

        $credentials = [
            'email' => $staff->email,
            'password' => 'incorrect-password',
        ];

        $this->postJson('/api/login', $credentials)
            ->assertUnauthorized();
        $this->postJson('/api/login', $credentials)
            ->assertUnauthorized();
        $this->postJson('/api/login', $credentials)
            ->assertStatus(429);
    }

    private function staffContext(): array
    {
        $role = Role::firstOrCreate(['name' => 'Staff']);
        $department = Department::firstOrCreate([
            'name' => 'Records Office',
        ]);
        $category = RecordCategory::firstOrCreate([
            'name' => 'General',
        ]);
        $staff = User::factory()->create([
            'role_id' => $role->id,
            'department_id' => $department->id,
            'status' => 'active',
            'password' => Hash::make('Password123'),
        ]);

        return [$staff, $department, $category];
    }

    private function staffUser(Department $department): User
    {
        $role = Role::firstOrCreate(['name' => 'Staff']);

        return User::factory()->create([
            'role_id' => $role->id,
            'department_id' => $department->id,
            'status' => 'active',
        ]);
    }

    private function archivedRecord(
        User $owner,
        Department $department,
        RecordCategory $category
    ): Record {
        return Record::create([
            'record_code' => 'ARCH-'.fake()->unique()->numerify('####'),
            'title' => 'Archived test record',
            'category_id' => $category->id,
            'department_id' => $department->id,
            'created_by' => $owner->id,
            'date_received' => now()->toDateString(),
            'status' => 'archived',
            'staff_visible' => true,
            'access_level' => 'internal',
            'storage_location' => 'Shelf A',
            'archived_at' => now(),
        ]);
    }

    private function recordFile(Record $record, User $owner): RecordFile
    {
        $path = "records/{$record->id}/document.pdf";
        Storage::disk('local')->put($path, 'test document');

        return RecordFile::create([
            'record_id' => $record->id,
            'uploaded_by' => $owner->id,
            'original_name' => 'document.pdf',
            'stored_name' => 'document.pdf',
            'file_path' => $path,
            'mime_type' => 'application/pdf',
            'file_size' => 13,
        ]);
    }

    private function registrationPayload(): array
    {
        return [
            'name' => 'New Staff',
            'email' => 'new.staff@example.test',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'department_id' => Department::firstOrFail()->id,
        ];
    }
}
