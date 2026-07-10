<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->text('review_remarks')
                ->nullable()
                ->after('remarks');

            $table->foreignId('reviewed_by')
                ->nullable()
                ->after('review_remarks')
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('reviewed_at')
                ->nullable()
                ->after('reviewed_by');

            $table->foreignId('archived_by')
                ->nullable()
                ->after('reviewed_at')
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('archived_at')
                ->nullable()
                ->after('archived_by');
        });
    }

    public function down(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropForeign(['archived_by']);

            $table->dropColumn([
                'review_remarks',
                'reviewed_by',
                'reviewed_at',
                'archived_by',
                'archived_at',
            ]);
        });
    }
};
