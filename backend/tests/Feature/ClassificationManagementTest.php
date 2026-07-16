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
            'retention_years' => 12,
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Research Records')
            ->assertJsonPath('data.retention_years', 12);

        $categoryId = $response->json('data.id');

        $this->patchJson("/api/admin/categories/{$categoryId}", [
            'name' => 'Research and Extension Records',
            'description' => 'Research and extension program documents.',
            'retention_years' => 15,
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
            'retention_years' => 5,
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

    public function test_admin_can_update_department_purpose_but_not_its_name(): void
    {
        $department = Department::firstOrCreate([
            'name' => 'College of Engineering (COE)',
        ]);
        $department->update(['description' => 'Old purpose.']);
        Sanctum::actingAs($this->userWithRole('Admin'));

        $this->patchJson("/api/admin/departments/{$department->id}", [
            'name' => 'Renamed College',
            'description' => 'Engineering programs and their records.',
        ])->assertOk();

        $department->refresh();

        $this->assertSame('College of Engineering (COE)', $department->name);
        $this->assertSame(
            'Engineering programs and their records.',
            $department->description
        );
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
