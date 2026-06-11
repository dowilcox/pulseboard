<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Clear dangling references left by deleted templates before adding the FK
        DB::table('boards')
            ->whereNotNull('default_task_template_id')
            ->whereNotIn('default_task_template_id', DB::table('task_templates')->select('id'))
            ->update(['default_task_template_id' => null]);

        // No-op on SQLite (foreign keys are only applied at table creation/alteration there)
        Schema::table('boards', function (Blueprint $table) {
            $table->foreign('default_task_template_id')
                ->references('id')
                ->on('task_templates')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('boards', function (Blueprint $table) {
            $table->dropForeign(['default_task_template_id']);
        });
    }
};
