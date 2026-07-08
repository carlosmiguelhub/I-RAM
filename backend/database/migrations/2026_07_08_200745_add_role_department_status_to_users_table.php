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
    Schema::table('users', function (Blueprint $table) {
        $table->foreignId('role_id')->nullable()->after('id')->constrained('roles')->nullOnDelete();
        $table->foreignId('department_id')->nullable()->after('role_id')->constrained('departments')->nullOnDelete();
        $table->enum('status', ['active', 'inactive'])->default('active')->after('password');
    });
}

    /**
     * Reverse the migrations.
     */
public function down(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->dropForeign(['role_id']);
        $table->dropForeign(['department_id']);
        $table->dropColumn(['role_id', 'department_id', 'status']);
    });
}
};
