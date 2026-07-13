<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_requests', function (Blueprint $table) {
            $table->id();

            $table->foreignId('record_id')
                ->constrained('records')
                ->cascadeOnDelete();

            $table->foreignId('requested_by')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->foreignId('assigned_to')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('purpose', 1000);

            $table->string('urgency', 30)
                ->default('normal');

            $table->string('preferred_format', 30)
                ->default('digital');

            $table->string('status', 30)
                ->default('pending');

            $table->text('request_notes')->nullable();
            $table->text('review_notes')->nullable();

            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('expires_at')->nullable();

            $table->timestamps();

            $table->index(['requested_by', 'status']);
            $table->index(['record_id', 'status']);
            $table->index(['assigned_to', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_requests');
    }
};