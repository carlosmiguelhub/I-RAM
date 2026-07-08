<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up(): void
{
    Schema::create('records', function (Blueprint $table) {
        $table->id();
        $table->string('record_code')->unique();
        $table->string('title');
        $table->text('description')->nullable();

        $table->foreignId('category_id')->constrained('record_categories')->cascadeOnDelete();
        $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
        $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();

        $table->date('date_received');
        $table->string('source')->nullable();

        $table->enum('status', [
            'received',
            'under_review',
            'archived',
            'for_disposal',
            'disposed'
        ])->default('received');

        $table->string('storage_location')->nullable();
        $table->text('remarks')->nullable();

        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('records');
    }
};
