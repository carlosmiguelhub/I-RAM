<?php

namespace Tests\Feature;

use App\Models\ArchiveFolder;
use App\Models\Department;
use App\Models\DocumentRequest;
use App\Models\Record;
use App\Models\RecordCategory;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PracticeDataCleanupTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_reset_practice_workspace_while_preserving_master_data(): void
    {
        $role = Role::firstOrCreate(['name' => 'Admin']);
        $department = Department::create([
            'name' => 'Practice Department',
            'description' => 'Preserved master data.',
            'accepts_submissions' => true,
        ]);
        $category = RecordCategory::create([
            'name' => 'Practice Category',
        ]);
        $admin = User::factory()->create([
            'role_id' => $role->id,
            'department_id' => $department->id,
            'status' => 'active',
            'password' => Hash::make('cleanup-password'),
        ]);
        $folder = ArchiveFolder::create([
            'name' => 'Practice Folder',
            'created_by' => $admin->id,
        ]);
        ArchiveFolder::create([
            'name' => 'Nested Practice Subfolder',
            'parent_id' => $folder->id,
            'created_by' => $admin->id,
        ]);
        $record = Record::create([
            'record_code' => 'PRACTICE-001',
            'title' => 'Practice record',
            'category_id' => $category->id,
            'department_id' => $department->id,
            'created_by' => $admin->id,
            'date_received' => now()->toDateString(),
            'status' => 'archived',
            'archive_folder_id' => $folder->id,
            'archived_at' => now(),
        ]);
        DocumentRequest::create([
            'record_id' => $record->id,
            'requested_by' => $admin->id,
            'purpose' => 'Practice cleanup test',
            'urgency' => 'normal',
            'preferred_format' => 'digital',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson('/api/admin/practice-data', [
            'confirmation' => 'RESET PRACTICE WORKSPACE',
            'password' => 'cleanup-password',
        ])->assertOk()
            ->assertJsonPath('deleted.records', 1)
            ->assertJsonPath('deleted.document_requests', 1)
            ->assertJsonPath('deleted.archive_folders', 2);

        $this->assertDatabaseCount('records', 0);
        $this->assertDatabaseCount('document_requests', 0);
        $this->assertDatabaseCount('archive_folders', 0);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseHas('departments', ['id' => $department->id]);
        $this->assertDatabaseHas('record_categories', ['id' => $category->id]);
    }
}
