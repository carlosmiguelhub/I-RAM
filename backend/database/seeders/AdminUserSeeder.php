<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $password = config('iram.admin.password');

        if (! is_string($password) || $password === '') {
            $this->command?->warn(
                'IRAM admin user was not seeded because IRAM_ADMIN_PASSWORD is not configured.'
            );

            return;
        }

        $adminRole = Role::where('name', 'Admin')->first();
        $recordsOffice = Department::where('name', 'Records Office')->first();

        User::updateOrCreate(
            ['email' => config('iram.admin.email')],
            [
                'role_id' => $adminRole?->id,
                'department_id' => $recordsOffice?->id,
                'name' => 'IRAM Admin',
                'password' => Hash::make($password),
                'status' => 'active',
                'email_verified_at' => now(),
                'activated_at' => now(),
            ]
        );
    }
}
