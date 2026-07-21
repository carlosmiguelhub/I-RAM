<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Record;
use App\Models\RecordCategory;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClassificationManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_record_categories(): void
    {
        Sanctum::actingAs($this->userWithRole('Admin'));

        $response = $this->postJson('/api/admin/categories', [
            'name' => 'Research Records',
            'description' => 'Studies, proposals, and research outputs.',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Research Records');

        $categoryId = $response->json('data.id');

        $this->patchJson("/api/admin/categories/{$categoryId}", [
            'name' => 'Research and Extension Records',
            'description' => 'Research and extension program documents.',
        ])->assertOk()
            ->assertJsonPath(
                'data.name',
                'Research and Extension Records'
            );

        $this->getJson('/api/admin/categories?search=Extension')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.records_count', 0);

        $this->deleteJson("/api/admin/categories/{$categoryId}")
            ->assertOk();

        $this->assertDatabaseMissing('record_categories', [
            'id' => $categoryId,
        ]);
    }

    public function test_category_in_use_cannot_be_deleted(): void
    {
        $admin = $this->userWithRole('Admin');
        $department = Department::firstOrCreate([
            'name' => 'College of Technology (COT)',
        ]);
        $category = RecordCategory::create([
            'name' => 'Protected Category',
        ]);
        Record::create([
            'record_code' => 'IRAM-TEST-001',
            'title' => 'Protected record',
            'category_id' => $category->id,
            'department_id' => $department->id,
            'created_by' => $admin->id,
            'date_received' => now()->toDateString(),
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('record_categories', [
            'id' => $category->id,
        ]);
        $this->assertDatabaseHas('records', [
            'record_code' => 'IRAM-TEST-001',
        ]);
    }

    public function test_admin_can_create_update_and_delete_a_department(): void
    {
        Sanctum::actingAs($this->userWithRole('Admin'));

        $response = $this->postJson('/api/admin/departments', [
            'name' => 'Research and Extension Office',
            'description' => 'Coordinates institutional research.',
            'accepts_submissions' => true,
        ])->assertCreated()
            ->assertJsonPath('data.accepts_submissions', true);

        $departmentId = $response->json('data.id');

        $this->patchJson("/api/admin/departments/{$departmentId}", [
            'name' => 'Research Office',
            'description' => 'Coordinates research records.',
            'accepts_submissions' => false,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Research Office')
            ->assertJsonPath('data.accepts_submissions', false);

        $this->deleteJson("/api/admin/departments/{$departmentId}")
            ->assertOk();

        $this->assertDatabaseMissing('departments', [
            'id' => $departmentId,
        ]);
    }

    public function test_non_admin_cannot_manage_classifications(): void
    {
        Sanctum::actingAs($this->userWithRole('Staff'));

        $this->getJson('/api/admin/categories')->assertForbidden();
        $this->getJson('/api/admin/departments')->assertForbidden();
    }

    private function userWithRole(string $roleName): User
    {
        $role = Role::firstOrCreate(['name' => $roleName]);

        return User::factory()->create([
            'role_id' => $role->id,
            'status' => 'active',
        ]);
    }
}
