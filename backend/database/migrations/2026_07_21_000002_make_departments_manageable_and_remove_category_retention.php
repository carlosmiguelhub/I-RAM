<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->boolean('accepts_submissions')
                ->default(true)
                ->after('description');
        });

        DB::table('departments')
            ->where('name', 'Records Office')
            ->update(['accepts_submissions' => false]);

        Schema::table('record_categories', function (Blueprint $table) {
            $table->dropColumn('retention_years');
        });
    }

    public function down(): void
    {
        Schema::table('record_categories', function (Blueprint $table) {
            $table->unsignedInteger('retention_years')
                ->default(5)
                ->after('description');
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('accepts_submissions');
        });
    }
};
