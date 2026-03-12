<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->index('user_id');
        });

        Schema::table('activities', function (Blueprint $table) {
            $table->index(['task_id', 'created_at']);
            $table->index('user_id');
        });

        Schema::table('task_labels', function (Blueprint $table) {
            $table->index('label_id');
        });

        Schema::table('labels', function (Blueprint $table) {
            $table->index(['team_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
        });

        Schema::table('activities', function (Blueprint $table) {
            $table->dropIndex(['task_id', 'created_at']);
            $table->dropIndex(['user_id']);
        });

        Schema::table('task_labels', function (Blueprint $table) {
            $table->dropIndex(['label_id']);
        });

        Schema::table('labels', function (Blueprint $table) {
            $table->dropIndex(['team_id', 'name']);
        });
    }
};
