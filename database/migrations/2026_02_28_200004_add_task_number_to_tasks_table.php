<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->unsignedInteger('task_number')->nullable()->after('column_id');
        });

        // Backfill existing tasks with sequential numbers per board
        $boards = DB::table('tasks')
            ->select('board_id')
            ->distinct()
            ->pluck('board_id');

        foreach ($boards as $boardId) {
            $tasks = DB::table('tasks')
                ->where('board_id', $boardId)
                ->orderBy('created_at')
                ->pluck('id');

            foreach ($tasks as $index => $taskId) {
                DB::table('tasks')
                    ->where('id', $taskId)
                    ->update(['task_number' => $index + 1]);
            }
        }

        Schema::table('tasks', function (Blueprint $table) {
            $table->unique(['board_id', 'task_number']);
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropUnique(['board_id', 'task_number']);
            $table->dropColumn('task_number');
        });
    }
};
