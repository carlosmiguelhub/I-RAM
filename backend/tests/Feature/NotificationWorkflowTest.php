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

class NotificationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_record_submission_notifies_active_managers(): void
    {
        [$staff, $admin, $officer, $department, $category] =
            $this->workflowUsers();
        $inactiveAdmin = $this->userWithRole(
            'Admin',
            $department,
            'inactive'
        );

        Sanctum::actingAs($staff);

        $this->postJson('/api/records', [
            'record_code' => 'REC-NOTIFY-001',
            'title' => 'Notification test record',
            'category_id' => $category->id,
            'department_id' => $department->id,
            'date_received' => now()->toDateString(),
        ])->assertCreated();

        foreach ([$admin, $officer] as $manager) {
            $notification = $manager->notifications()->first();

            $this->assertNotNull($notification);
            $this->assertSame(
                'record.submitted',
                $notification->data['type']
            );
            $this->assertSame(
                '/records?status=received',
                $notification->data['url']
            );
        }

        $this->assertSame(
            0,
            $inactiveAdmin->notifications()->count()
        );
        $this->assertSame(0, $staff->notifications()->count());
    }

    public function test_request_review_and_approval_notify_the_requester(): void
    {
        [$staff, $admin, , $department, $category] =
            $this->workflowUsers();
        $record = $this->archivedRecord(
            $admin,
            $department,
            $category
        );

        Sanctum::actingAs($staff);

        $requestResponse = $this->postJson('/api/document-requests', [
            'record_id' => $record->id,
            'purpose' => 'Notification workflow testing',
            'urgency' => 'normal',
            'preferred_format' => 'digital',
        ])->assertCreated();

        $documentRequestId = $requestResponse->json('request.id');

        $this->assertSame(
            'document_request.submitted',
            $admin->notifications()->latest()->first()->data['type']
        );

        Sanctum::actingAs($admin);

        $this->postJson(
            "/api/document-requests/{$documentRequestId}/start-review"
        )->assertOk();
        $this->postJson(
            "/api/document-requests/{$documentRequestId}/approve",
            ['review_notes' => 'Approved for digital access.']
        )->assertOk();

        $types = $staff->notifications()
            ->latest()
            ->get()
            ->pluck('data')
            ->map(fn (array $data) => $data['type'])
            ->all();

        $this->assertEqualsCanonicalizing([
            'document_request.approved',
            'document_request.review_started',
        ], $types);
    }

    public function test_user_can_read_only_their_own_notifications(): void
    {
        [$staff, $admin, , $department, $category] =
            $this->workflowUsers();

        Sanctum::actingAs($staff);

        $this->postJson('/api/records', [
            'record_code' => 'REC-NOTIFY-002',
            'title' => 'Read state test',
            'category_id' => $category->id,
            'department_id' => $department->id,
            'date_received' => now()->toDateString(),
        ])->assertCreated();

        $adminNotification = $admin->notifications()->firstOrFail();

        Sanctum::actingAs($admin);

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath(
                'notifications.0.data.type',
                'record.submitted'
            );

        $this->patchJson(
            "/api/notifications/{$adminNotification->id}/read"
        )
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->assertNotNull(
            $adminNotification->fresh()->read_at
        );

        Sanctum::actingAs($staff);

        $this->patchJson(
            "/api/notifications/{$adminNotification->id}/read"
        )->assertNotFound();
    }

    private function workflowUsers(): array
    {
        $department = Department::firstOrCreate([
            'name' => 'College of Technology (COT)',
        ]);
        $category = RecordCategory::create([
            'name' => 'General Records',
        ]);
        $staff = $this->userWithRole('Staff', $department);
        $admin = $this->userWithRole('Admin', $department);
        $officer = $this->userWithRole(
            'Records Officer',
            $department
        );

        return [
            $staff,
            $admin,
            $officer,
            $department,
            $category,
        ];
    }

    private function userWithRole(
        string $roleName,
        Department $department,
        string $status = 'active'
    ): User {
        $role = Role::firstOrCreate(['name' => $roleName]);

        return User::factory()->create([
            'role_id' => $role->id,
            'department_id' => $department->id,
            'status' => $status,
        ]);
    }

    private function archivedRecord(
        User $owner,
        Department $department,
        RecordCategory $category
    ): Record {
        return Record::create([
            'record_code' => 'ARCH-NOTIFY-001',
            'title' => 'Archived notification record',
            'category_id' => $category->id,
            'department_id' => $department->id,
            'created_by' => $owner->id,
            'date_received' => now()->toDateString(),
            'status' => 'archived',
            'staff_visible' => true,
            'access_level' => 'internal',
            'storage_location' => 'Shelf N',
            'archived_at' => now(),
        ]);
    }
}
