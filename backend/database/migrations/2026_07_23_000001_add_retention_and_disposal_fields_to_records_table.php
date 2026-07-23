<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->string('retention_type', 20)
                ->default('permanent')
                ->after('archived_at');
            $table->unsignedSmallInteger('retention_years')
                ->nullable()
                ->after('retention_type');
            $table->timestamp('retention_expires_at')
                ->nullable()
                ->after('retention_years');
            $table->timestamp('for_disposal_at')
                ->nullable()
                ->after('retention_expires_at');
            $table->foreignId('disposed_by')
                ->nullable()
                ->after('for_disposal_at')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('disposed_at')
                ->nullable()
                ->after('disposed_by');
            $table->text('disposal_notes')
                ->nullable()
                ->after('disposed_at');

            $table->index([
                'status',
                'retention_type',
                'retention_expires_at',
            ], 'records_retention_due_index');
        });
    }

    public function down(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->dropIndex('records_retention_due_index');
            $table->dropForeign(['disposed_by']);
            $table->dropColumn([
                'retention_type',
                'retention_years',
                'retention_expires_at',
                'for_disposal_at',
                'disposed_by',
                'disposed_at',
                'disposal_notes',
            ]);
        });
    }
};
