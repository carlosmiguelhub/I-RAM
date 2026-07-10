<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE records
            MODIFY status ENUM(
                'received',
                'under_review',
                'returned_for_correction',
                'archived',
                'for_disposal',
                'disposed'
            ) NOT NULL DEFAULT 'received'
        ");

        Schema::table('records', function (Blueprint $table) {
            $table->text('correction_notes')
                ->nullable()
                ->after('review_remarks');

            $table->foreignId('returned_by')
                ->nullable()
                ->after('correction_notes')
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('returned_at')
                ->nullable()
                ->after('returned_by');

            $table->timestamp('resubmitted_at')
                ->nullable()
                ->after('returned_at');
        });
    }

    public function down(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->dropForeign(['returned_by']);

            $table->dropColumn([
                'correction_notes',
                'returned_by',
                'returned_at',
                'resubmitted_at',
            ]);
        });

        DB::statement("
            ALTER TABLE records
            MODIFY status ENUM(
                'received',
                'under_review',
                'archived',
                'for_disposal',
                'disposed'
            ) NOT NULL DEFAULT 'received'
        ");
    }
};
