<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountVerificationAndActivationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_account_requires_email_verification_then_manager_activation(): void
    {
        Notification::fake();

        $staffRole = Role::create(['name' => 'Staff']);
        $adminRole = Role::create(['name' => 'Admin']);
        $department = Department::create(['name' => 'Records Office']);
        SystemSetting::setValue(
            'security',
            'allow_registration',
            true,
            'boolean',
            true
        );

        $response = $this->postJson('/api/register', [
            'name' => 'Pending Staff',
            'email' => 'PENDING.STAFF@example.test',
            'department_id' => $department->id,
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.role.id', $staffRole->id)
            ->assertJsonPath('user.status', 'inactive')
            ->assertJsonMissingPath('token');

        $user = User::where('email', 'pending.staff@example.test')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        $this->assertNull($user->activated_at);
        Notification::assertSentTo(
            $user,
            VerifyEmailNotification::class,
            function (VerifyEmailNotification $notification) use ($user) {
                $mail = $notification->toMail($user);

                return str_starts_with(
                    $mail->actionUrl,
                    'http://localhost:3000/verify-email?'
                );
            }
        );

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password123',
        ])->assertForbidden()->assertJsonPath('code', 'email_unverified');

        $admin = User::factory()->create([
            'role_id' => $adminRole->id,
            'department_id' => $department->id,
            'status' => 'active',
        ]);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/users/{$user->id}/status", [
            'status' => 'active',
        ])->assertUnprocessable();

        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            [
                'id' => $user->id,
                'hash' => sha1($user->email),
            ],
            absolute: false
        );

        $this->getJson($verificationUrl)
            ->assertOk()
            ->assertJsonPath('status', 'activation_pending');

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password123',
        ])->assertForbidden()->assertJsonPath('code', 'activation_pending');

        $this->patchJson("/api/admin/users/{$user->id}/status", [
            'status' => 'active',
        ])->assertOk();

        $user->refresh();
        $this->assertNotNull($user->email_verified_at);
        $this->assertNotNull($user->activated_at);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password123',
        ])->assertOk()->assertJsonStructure(['token', 'user']);
    }

    public function test_records_officer_cannot_access_admin_user_management(): void
    {
        $staffRole = Role::create(['name' => 'Staff']);
        $officerRole = Role::create(['name' => 'Records Officer']);
        $ownDepartment = Department::create(['name' => 'Own Department']);
        $otherDepartment = Department::create(['name' => 'Other Department']);

        $officer = User::factory()->create([
            'role_id' => $officerRole->id,
            'department_id' => $ownDepartment->id,
            'status' => 'active',
        ]);
        $ownStaff = User::factory()->create([
            'role_id' => $staffRole->id,
            'department_id' => $ownDepartment->id,
            'status' => 'inactive',
        ]);
        $otherStaff = User::factory()->create([
            'role_id' => $staffRole->id,
            'department_id' => $otherDepartment->id,
            'status' => 'inactive',
        ]);

        Sanctum::actingAs($officer);

        $this->getJson('/api/admin/users')
            ->assertForbidden();

        $this->patchJson("/api/admin/users/{$ownStaff->id}/status", [
            'status' => 'active',
        ])->assertForbidden();

        $this->patchJson("/api/admin/users/{$otherStaff->id}/status", [
            'status' => 'active',
        ])->assertForbidden();
    }
}
