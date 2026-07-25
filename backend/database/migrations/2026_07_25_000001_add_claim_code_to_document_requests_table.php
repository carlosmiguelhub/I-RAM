<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_requests', function (Blueprint $table) {
            $table->string('claim_code', 40)
                ->nullable()
                ->unique()
                ->after('ready_for_pickup_at');
        });
    }

    public function down(): void
    {
        Schema::table('document_requests', function (Blueprint $table) {
            $table->dropUnique(['claim_code']);
            $table->dropColumn('claim_code');
        });
    }
};
