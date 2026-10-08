<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The dashboard's recent-activity feed orders activities across all of
        // a user's boards by created_at; the existing (task_id, created_at)
        // index only helps per-task lookups.
        Schema::table('activities', function (Blueprint $table) {
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->dropIndex(['created_at']);
        });
    }
};
