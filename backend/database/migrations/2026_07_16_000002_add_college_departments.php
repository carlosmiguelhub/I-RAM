<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $colleges = [
            'College of Technology (COT)' => 'Technology programs and academic units.',
            'College of Engineering (COE)' => 'Engineering programs and academic units.',
            'College of Education Arts and Sciences (CEAS)' => 'Education, arts, and sciences programs and academic units.',
            'College of Management and Entrepreneurship (CME)' => 'Management and entrepreneurship programs and academic units.',
        ];

        foreach ($colleges as $name => $description) {
            DB::table('departments')->updateOrInsert(
                ['name' => $name],
                [
                    'description' => $description,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        // College rows may already be referenced by users and records,
        // so rollback intentionally preserves institutional data.
    }
};
