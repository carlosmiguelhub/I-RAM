<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('archive_folders', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('created_by')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->timestamps();

            $table->unique('name');
        });

        Schema::table('records', function (Blueprint $table) {
            $table->foreignId('archive_folder_id')
                ->nullable()
                ->after('archived_at')
                ->constrained('archive_folders')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->dropForeign(['archive_folder_id']);
            $table->dropColumn('archive_folder_id');
        });

        Schema::dropIfExists('archive_folders');
    }
};
