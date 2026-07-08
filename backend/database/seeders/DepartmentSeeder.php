<?php

namespace Database\Seeders;

use App\Models\Department;
use Illuminate\Database\Seeder;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        $departments = [
            [
                'name' => 'Records Office',
                'description' => 'Main office responsible for records management.',
            ],
            [
                'name' => 'Registrar',
                'description' => 'Handles student records and academic documents.',
            ],
            [
                'name' => 'Accounting',
                'description' => 'Handles financial and payment-related records.',
            ],
            [
                'name' => 'Human Resources',
                'description' => 'Handles employee and personnel records.',
            ],
            [
                'name' => 'IT Department',
                'description' => 'Handles technical and system-related records.',
            ],
        ];

        foreach ($departments as $department) {
            Department::updateOrCreate(
                ['name' => $department['name']],
                $department
            );
        }
    }
}