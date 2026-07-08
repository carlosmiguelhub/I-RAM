<?php

namespace Database\Seeders;

use App\Models\RecordCategory;
use Illuminate\Database\Seeder;

class RecordCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Student Records',
                'description' => 'Academic and enrollment-related student documents.',
                'retention_years' => 10,
            ],
            [
                'name' => 'Financial Records',
                'description' => 'Accounting, billing, receipts, and payment-related records.',
                'retention_years' => 7,
            ],
            [
                'name' => 'Personnel Records',
                'description' => 'Employee files and HR-related documents.',
                'retention_years' => 10,
            ],
            [
                'name' => 'Administrative Records',
                'description' => 'Office memos, requests, reports, and administrative documents.',
                'retention_years' => 5,
            ],
            [
                'name' => 'Legal Documents',
                'description' => 'Contracts, agreements, and compliance-related files.',
                'retention_years' => 15,
            ],
        ];

        foreach ($categories as $category) {
            RecordCategory::updateOrCreate(
                ['name' => $category['name']],
                $category
            );
        }
    }
}