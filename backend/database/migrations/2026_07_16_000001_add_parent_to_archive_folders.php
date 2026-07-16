<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archive_folders', function (Blueprint $table) {
            $table->dropUnique(['name']);
            $table->foreignId('parent_id')
                ->nullable()
                ->after('id')
                ->constrained('archive_folders')
                ->restrictOnDelete();
            $table->index(['parent_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::table('archive_folders', function (Blueprint $table) {
            $table->dropIndex(['parent_id', 'name']);
            $table->dropForeign(['parent_id']);
            $table->dropColumn('parent_id');
            $table->unique('name');
        });
    }
};
