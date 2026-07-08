<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use App\Models\Department;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $adminRole = Role::where('name', 'Admin')->first();
        $recordsOffice = Department::where('name', 'Records Office')->first();

        User::updateOrCreate(
            ['email' => 'admin@iram.test'],
            [
                'role_id' => $adminRole?->id,
                'department_id' => $recordsOffice?->id,
                'name' => 'IRAM Admin',
                'password' => Hash::make('password123'),
                'status' => 'active',
            ]
        );
    }
}