<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->boolean('staff_visible')
                ->default(false)
                ->after('archive_folder_id');

            $table->string('access_level', 30)
                ->default('restricted')
                ->after('staff_visible');

            $table->index([
                'status',
                'staff_visible',
                'access_level',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->dropIndex([
                'status',
                'staff_visible',
                'access_level',
            ]);

            $table->dropColumn([
                'staff_visible',
                'access_level',
            ]);
        });
    }
};