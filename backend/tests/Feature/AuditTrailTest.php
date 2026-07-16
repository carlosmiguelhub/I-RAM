<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditTrailTest extends TestCase
{
    use RefreshDatabase;

    public function test_records_officer_can_search_and_filter_the_audit_trail(): void
    {
        $officer = $this->userWithRole('Records Officer');
        $otherActor = $this->userWithRole('Admin');

        AuditLog::create([
            'user_id' => $officer->id,
            'action' => 'created_archive_folder',
            'description' => 'Created archive folder: Academic Records',
            'ip_address' => '127.0.0.1',
        ]);
        AuditLog::create([
            'user_id' => $otherActor->id,
            'action' => 'settings.updated',
            'description' => 'Updated security settings',
            'ip_address' => '10.0.0.2',
        ]);

        Sanctum::actingAs($officer);

        $this->getJson('/api/audit-trail?action=created_archive_folder&search=Academic')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user.name', $officer->name)
            ->assertJsonPath('data.0.action', 'created_archive_folder')
            ->assertJsonPath('summary.total', 2)
            ->assertJsonFragment(['name' => $otherActor->name]);
    }

    public function test_staff_cannot_view_the_audit_trail(): void
    {
        Sanctum::actingAs($this->userWithRole('Staff'));

        $this->getJson('/api/audit-trail')->assertForbidden();
    }

    public function test_successful_sign_in_is_recorded(): void
    {
        $user = $this->userWithRole('Records Officer');

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'authenticated_session_started',
        ]);
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
