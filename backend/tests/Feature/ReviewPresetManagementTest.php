<?php

namespace Tests\Feature;

use App\Models\ReviewPreset;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReviewPresetManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_both_review_preset_types(): void
    {
        Sanctum::actingAs($this->userWithRole('Admin'));

        $remark = $this->postJson('/api/admin/review-presets', [
            'type' => ReviewPreset::REVIEW_REMARK,
            'value' => 'Verified and complete.',
        ])->assertCreated()->json('data');

        $location = $this->postJson('/api/admin/review-presets', [
            'type' => ReviewPreset::STORAGE_LOCATION,
            'value' => 'Archive Room A / Shelf 2',
        ])->assertCreated()->json('data');

        $this->getJson('/api/admin/review-presets')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->patchJson("/api/admin/review-presets/{$remark['id']}", [
            'type' => ReviewPreset::REVIEW_REMARK,
            'value' => 'Verified against the submitted files.',
        ])->assertOk()
            ->assertJsonPath(
                'data.value',
                'Verified against the submitted files.'
            );

        $this->deleteJson(
            "/api/admin/review-presets/{$location['id']}"
        )->assertOk();

        $this->assertDatabaseMissing('review_presets', [
            'id' => $location['id'],
        ]);
    }

    public function test_records_officer_can_read_but_cannot_manage_presets(): void
    {
        ReviewPreset::create([
            'type' => ReviewPreset::REVIEW_REMARK,
            'value' => 'Files checked.',
        ]);
        Sanctum::actingAs($this->userWithRole('Records Officer'));

        $this->getJson('/api/review-presets')
            ->assertOk()
            ->assertJsonPath('data.0.value', 'Files checked.');

        $this->postJson('/api/admin/review-presets', [
            'type' => ReviewPreset::STORAGE_LOCATION,
            'value' => 'Shelf A',
        ])->assertForbidden();
    }

    public function test_staff_cannot_read_or_manage_presets(): void
    {
        Sanctum::actingAs($this->userWithRole('Staff'));

        $this->getJson('/api/review-presets')->assertForbidden();
        $this->getJson('/api/admin/review-presets')->assertForbidden();
    }

    public function test_duplicate_values_within_a_type_are_rejected(): void
    {
        Sanctum::actingAs($this->userWithRole('Admin'));
        ReviewPreset::create([
            'type' => ReviewPreset::STORAGE_LOCATION,
            'value' => 'Shelf A',
        ]);

        $this->postJson('/api/admin/review-presets', [
            'type' => ReviewPreset::STORAGE_LOCATION,
            'value' => 'Shelf A',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('value');
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
