<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->boolean('legal_hold')
                ->default(false)
                ->after('disposal_notes');
            $table->text('legal_hold_reason')
                ->nullable()
                ->after('legal_hold');
            $table->foreignId('legal_hold_by')
                ->nullable()
                ->after('legal_hold_reason')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('legal_hold_at')
                ->nullable()
                ->after('legal_hold_by');
        });

        Schema::table('record_files', function (Blueprint $table) {
            $table->timestamp('purged_at')
                ->nullable()
                ->after('file_size');
            $table->foreignId('purged_by')
                ->nullable()
                ->after('purged_at')
                ->constrained('users')
                ->nullOnDelete();
            $table->text('purge_reason')
                ->nullable()
                ->after('purged_by');
        });

        Schema::create('disposal_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('record_id')
                ->constrained('records')
                ->cascadeOnDelete();
            $table->foreignId('requested_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('rejected_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('cancelled_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('status', 30)->default('pending');
            $table->string('authority_reference', 255);
            $table->text('reason');
            $table->string('disposal_method', 100);
            $table->text('notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('certificate_number', 100)
                ->nullable()
                ->unique();
            $table->timestamp('requested_at');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('scheduled_purge_at')->nullable();
            $table->timestamp('purge_reminder_sent_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(
                ['status', 'scheduled_purge_at'],
                'disposal_cases_due_index'
            );
        });

        DB::table('system_settings')->insertOrIgnore([
            'group' => 'workflow',
            'key' => 'disposal_grace_days',
            'value' => '30',
            'type' => 'integer',
            'is_public' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('key', 'disposal_grace_days')
            ->delete();

        Schema::dropIfExists('disposal_cases');

        Schema::table('record_files', function (Blueprint $table) {
            $table->dropForeign(['purged_by']);
            $table->dropColumn([
                'purged_at',
                'purged_by',
                'purge_reason',
            ]);
        });

        Schema::table('records', function (Blueprint $table) {
            $table->dropForeign(['legal_hold_by']);
            $table->dropColumn([
                'legal_hold',
                'legal_hold_reason',
                'legal_hold_by',
                'legal_hold_at',
            ]);
        });
    }
};
