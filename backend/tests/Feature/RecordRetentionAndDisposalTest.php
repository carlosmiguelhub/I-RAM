<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Record;
use App\Models\RecordCategory;
use App\Models\Role;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\RecordRetentionService;
use Illuminate\Support\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RecordRetentionAndDisposalTest extends TestCase
{
    use RefreshDatabase;

    public function test_expired_temporary_record_is_transferred_hidden_and_notified(): void
    {
        Notification::fake();
        [$staff, $officer, $record] = $this->scenario();

        $moved = app(RecordRetentionService::class)
            ->moveExpiredRecords();

        $this->assertSame(1, $moved);
        $this->assertDatabaseHas('records', [
            'id' => $record->id,
            'status' => 'for_disposal',
            'staff_visible' => false,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'record_id' => $record->id,
            'action' => 'retention_expired',
        ]);
        Notification::assertSentTo(
            $officer,
            InAppNotification::class
        );

        Sanctum::actingAs($staff);
        $this->getJson("/api/records/{$record->id}")
            ->assertForbidden();
        $this->getJson('/api/staff/archive-catalog')
            ->assertOk()
            ->assertJsonMissing(['record_code' => $record->record_code]);
    }

    public function test_officer_can_restore_or_mark_record_disposed(): void
    {
        [, $officer, $record] = $this->scenario();
        app(RecordRetentionService::class)->moveExpiredRecords();
        Sanctum::actingAs($officer);

        $this->getJson('/api/disposal/records')
            ->assertOk()
            ->assertJsonFragment([
                'record_code' => $record->record_code,
            ]);

        $this->postJson(
            "/api/disposal/records/{$record->id}/restore",
            [
                'retention_type' => 'temporary',
                'retention_years' => 2,
                'notes' => 'Extended after records review.',
            ]
        )->assertOk();

        $record->refresh();
        $this->assertSame('archived', $record->status);
        $this->assertSame(2, $record->retention_years);
        $this->assertTrue($record->staff_visible);
        $this->assertTrue(
            $record->retention_expires_at->isFuture()
        );

        $record->update([
            'status' => 'for_disposal',
            'for_disposal_at' => now(),
            'staff_visible' => false,
        ]);

        $this->postJson(
            "/api/disposal/records/{$record->id}/dispose",
            [
                'disposal_notes' => 'Approved under disposal authority 2026-07.',
            ]
        )->assertOk();

        $this->assertDatabaseHas('records', [
            'id' => $record->id,
            'status' => 'disposed',
            'disposed_by' => $officer->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'record_id' => $record->id,
            'action' => 'disposed_record',
        ]);
    }

    public function test_one_minute_practice_retention_uses_normal_expiry_workflow(): void
    {
        Notification::fake();
        [, $officer, $record] = $this->scenario();
        $record->update([
            'retention_type' => 'permanent',
            'retention_years' => null,
            'retention_expires_at' => null,
        ]);
        Sanctum::actingAs($officer);

        $this->patchJson(
            "/api/archive/records/{$record->id}/retention",
            [
                'retention_type' => 'temporary',
                'retention_years' => 1,
                'retention_unit' => 'minutes',
            ]
        )->assertOk();

        $record->refresh();
        $this->assertSame('minutes', $record->retention_unit);
        $this->assertTrue(
            $record->retention_expires_at->between(
                now()->addSeconds(55),
                now()->addSeconds(65)
            )
        );

        Carbon::setTestNow(now()->addMinutes(2));
        app(RecordRetentionService::class)->moveExpiredRecords();
        Carbon::setTestNow();

        $this->assertDatabaseHas('records', [
            'id' => $record->id,
            'status' => 'for_disposal',
            'staff_visible' => false,
        ]);
    }

    private function scenario(): array
    {
        $staffRole = Role::create(['name' => 'Staff']);
        $officerRole = Role::create(['name' => 'Records Officer']);
        $department = Department::create([
            'name' => 'Retention Test Department',
            'code' => 'RTD',
        ]);
        $category = RecordCategory::create([
            'name' => 'Retention Test Category',
            'code' => 'RTC',
        ]);
        $staff = User::factory()->create([
            'role_id' => $staffRole->id,
            'department_id' => $department->id,
            'status' => 'active',
        ]);
        $officer = User::factory()->create([
            'role_id' => $officerRole->id,
            'department_id' => $department->id,
            'status' => 'active',
        ]);
        $record = Record::create([
            'record_code' => 'RETENTION-001',
            'title' => 'Expired temporary record',
            'category_id' => $category->id,
            'department_id' => $department->id,
            'created_by' => $staff->id,
            'date_received' => now()->subYears(3)->toDateString(),
            'status' => 'archived',
            'archived_by' => $officer->id,
            'archived_at' => now()->subYears(2),
            'retention_type' => 'temporary',
            'retention_years' => 1,
            'retention_expires_at' => now()->subYear(),
            'staff_visible' => true,
            'access_level' => 'internal',
        ]);

        return [$staff, $officer, $record];
    }
}
