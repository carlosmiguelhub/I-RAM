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
            ],
            [
                'name' => 'Financial Records',
                'description' => 'Accounting, billing, receipts, and payment-related records.',
            ],
            [
                'name' => 'Personnel Records',
                'description' => 'Employee files and HR-related documents.',
            ],
            [
                'name' => 'Administrative Records',
                'description' => 'Office memos, requests, reports, and administrative documents.',
            ],
            [
                'name' => 'Legal Documents',
                'description' => 'Contracts, agreements, and compliance-related files.',
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
