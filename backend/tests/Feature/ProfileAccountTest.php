<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfileAccountTest extends TestCase
{
    use RefreshDatabase;

    private Role $staffRole;

    private Department $department;

    protected function setUp(): void
    {
        parent::setUp();

        $this->staffRole = Role::create(['name' => 'Staff']);
        $this->department = Department::create([
            'name' => 'Administrative Services',
        ]);
    }

    public function test_authenticated_user_can_view_their_profile_summary(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);

        $this->getJson('/api/profile')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role.name', 'Staff')
            ->assertJsonPath(
                'user.department.name',
                'Administrative Services'
            )
            ->assertJsonStructure([
                'activity' => [
                    'submitted_records',
                    'active_submissions',
                    'document_requests',
                    'released_requests',
                ],
                'security' => [
                    'active_sessions',
                    'current_session',
                    'last_activity_at',
                ],
            ]);
    }

    public function test_user_can_update_only_their_own_profile_name(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user);

        $this->patchJson('/api/profile', [
            'name' => 'Updated Account Name',
            'email' => 'changed@example.test',
            'status' => 'inactive',
        ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Updated Account Name')
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('user.status', 'active');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Updated Account Name',
            'email' => $user->email,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'target_user_id' => $user->id,
            'action' => 'profile_name_updated',
        ]);
    }

    public function test_password_change_checks_current_password_and_revokes_other_sessions(): void
    {
        $user = $this->createUser();
        $currentToken = $user->createToken('Current browser');
        $user->createToken('Other device');

        $this->withToken($currentToken->plainTextToken)
            ->patchJson('/api/profile/password', [
                'current_password' => 'IncorrectPassword123',
                'password' => 'NewPassword456',
                'password_confirmation' => 'NewPassword456',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $this->withToken($currentToken->plainTextToken)
            ->patchJson('/api/profile/password', [
                'current_password' => 'Password123',
                'password' => 'NewPassword456',
                'password_confirmation' => 'NewPassword456',
            ])
            ->assertOk()
            ->assertJsonPath('revoked_sessions', 1);

        $this->assertTrue(
            Hash::check('NewPassword456', $user->fresh()->password)
        );
        $this->assertSame(1, $user->tokens()->count());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'profile_password_changed',
        ]);
    }

    public function test_user_can_logout_other_devices_without_ending_current_session(): void
    {
        $user = $this->createUser();
        $currentToken = $user->createToken('Current browser');
        $user->createToken('Phone');
        $user->createToken('Tablet');

        $this->withToken($currentToken->plainTextToken)
            ->postJson('/api/profile/logout-other-devices', [
                'current_password' => 'Password123',
            ])
            ->assertOk()
            ->assertJsonPath('revoked_sessions', 2);

        $this->assertSame(1, $user->tokens()->count());
        $this->assertTrue(
            $user->tokens()
                ->whereKey($currentToken->accessToken->getKey())
                ->exists()
        );
        $this->assertSame(
            1,
            AuditLog::where('user_id', $user->id)
                ->where('action', 'other_sessions_revoked')
                ->count()
        );
    }

    private function createUser(): User
    {
        return User::factory()->create([
            'role_id' => $this->staffRole->id,
            'department_id' => $this->department->id,
            'password' => Hash::make('Password123'),
            'status' => 'active',
            'activated_at' => now(),
        ]);
    }
}
