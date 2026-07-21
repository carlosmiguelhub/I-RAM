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
                'description' => 'Central office responsible for institutional records management.',
                'accepts_submissions' => false,
            ],
            [
                'name' => 'College of Technology (COT)',
                'description' => 'Technology programs and academic units.',
                'accepts_submissions' => true,
            ],
            [
                'name' => 'College of Engineering (COE)',
                'description' => 'Engineering programs and academic units.',
                'accepts_submissions' => true,
            ],
            [
                'name' => 'College of Education Arts and Sciences (CEAS)',
                'description' => 'Education, arts, and sciences programs and academic units.',
                'accepts_submissions' => true,
            ],
            [
                'name' => 'College of Management and Entrepreneurship (CME)',
                'description' => 'Management and entrepreneurship programs and academic units.',
                'accepts_submissions' => true,
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
