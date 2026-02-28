<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->json('recurrence_config')->nullable()->after('checklists');
            $table->timestamp('recurrence_next_at')->nullable()->after('recurrence_config');

            $table->index('recurrence_next_at');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex(['recurrence_next_at']);
            $table->dropColumn(['recurrence_config', 'recurrence_next_at']);
        });
    }
};
