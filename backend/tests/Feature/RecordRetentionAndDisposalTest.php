<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\DisposalCase;
use App\Models\Record;
use App\Models\RecordCategory;
use App\Models\RecordFile;
use App\Models\Role;
use App\Models\User;
use App\Notifications\InAppNotification;
use App\Services\RecordRetentionService;
use App\Services\RecordDisposalService;
use Illuminate\Support\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
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

    public function test_disposal_requires_independent_approval_and_preserves_file_metadata(): void
    {
        Notification::fake();
        Storage::fake('local');
        [, $officer, $record, $admin] = $this->scenario();
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

        $filePath = "records/{$record->id}/test.pdf";
        Storage::disk('local')->put($filePath, 'test attachment');
        $file = RecordFile::create([
            'record_id' => $record->id,
            'uploaded_by' => $officer->id,
            'original_name' => 'test.pdf',
            'stored_name' => 'test.pdf',
            'file_path' => $filePath,
            'mime_type' => 'application/pdf',
            'file_size' => 15,
        ]);

        $this->postJson(
            "/api/disposal/records/{$record->id}/request",
            [
                'authority_reference' => 'AUTH-2026-07',
                'reason' => 'Retention period completed.',
                'disposal_method' => 'secure_digital_deletion',
            ]
        )->assertCreated();

        $case = DisposalCase::where('record_id', $record->id)->firstOrFail();

        $this->postJson(
            "/api/disposal/cases/{$case->id}/approve",
            ['confirmation' => $record->record_code]
        )->assertForbidden();

        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/disposal/cases/{$case->id}/approve",
            ['confirmation' => $record->record_code]
        )->assertOk();

        $this->assertDatabaseHas('disposal_cases', [
            'id' => $case->id,
            'status' => 'approved',
            'approved_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('records', [
            'id' => $record->id,
            'status' => 'for_disposal',
        ]);
        Storage::disk('local')->assertExists($filePath);

        Carbon::setTestNow(now()->addDays(31));
        app(RecordDisposalService::class)->processApprovedCases();
        Carbon::setTestNow();

        $this->assertDatabaseHas('records', [
            'id' => $record->id,
            'status' => 'disposed',
            'disposed_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'record_id' => $record->id,
            'action' => 'disposal_files_purged',
        ]);
        $this->assertDatabaseHas('record_files', [
            'id' => $file->id,
            'original_name' => 'test.pdf',
            'purged_by' => $admin->id,
        ]);
        Storage::disk('local')->assertMissing($filePath);

        $this->getJson('/api/disposal/disposed')
            ->assertOk()
            ->assertJsonFragment([
                'record_code' => $record->record_code,
            ]);
        $this->getJson(
            "/api/disposal/cases/{$case->id}/certificate"
        )
            ->assertOk()
            ->assertJsonPath(
                'certificate.certificate_number',
                "DC-".now()->format('Y').'-'.str_pad(
                    (string) $case->id,
                    6,
                    '0',
                    STR_PAD_LEFT
                )
            );
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

    public function test_legal_hold_blocks_purge_and_release_restarts_grace_period(): void
    {
        Notification::fake();
        [, $officer, $record, $admin] = $this->scenario();
        app(RecordRetentionService::class)->moveExpiredRecords();
        Sanctum::actingAs($officer);

        $this->postJson(
            "/api/disposal/records/{$record->id}/request",
            [
                'authority_reference' => 'LEGAL-TEST-01',
                'reason' => 'Routine expiry.',
                'disposal_method' => 'secure_digital_deletion',
            ]
        )->assertCreated();
        $case = DisposalCase::where('record_id', $record->id)->firstOrFail();

        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/disposal/cases/{$case->id}/approve",
            ['confirmation' => $record->record_code]
        )->assertOk();
        $this->patchJson(
            "/api/disposal/records/{$record->id}/legal-hold",
            [
                'legal_hold' => true,
                'reason' => 'Pending litigation review.',
            ]
        )->assertOk();

        Carbon::setTestNow(now()->addDays(31));
        app(RecordDisposalService::class)->processApprovedCases();

        $this->assertDatabaseHas('records', [
            'id' => $record->id,
            'status' => 'for_disposal',
            'legal_hold' => true,
        ]);

        $this->patchJson(
            "/api/disposal/records/{$record->id}/legal-hold",
            ['legal_hold' => false]
        )->assertOk();
        $case->refresh();

        $this->assertTrue($case->scheduled_purge_at->isFuture());
        Carbon::setTestNow();
    }

    private function scenario(): array
    {
        $staffRole = Role::create(['name' => 'Staff']);
        $officerRole = Role::create(['name' => 'Records Officer']);
        $adminRole = Role::create(['name' => 'Admin']);
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
        $admin = User::factory()->create([
            'role_id' => $adminRole->id,
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

        return [$staff, $officer, $record, $admin];
    }
}
