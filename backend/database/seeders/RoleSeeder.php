<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name' => 'Admin',
                'description' => 'Has full access to the system.',
            ],
            [
                'name' => 'Records Officer',
                'description' => 'Manages record acquisition, archiving, and record updates.',
            ],
            [
                'name' => 'Staff',
                'description' => 'Can submit and view assigned records.',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['name' => $role['name']],
                $role
            );
        }
    }
}