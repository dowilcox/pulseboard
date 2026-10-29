<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Authorship columns used `restrictOnDelete`, so deleting a user who had
 * created a task, dependency or task template, or assigned someone to a task,
 * failed with a foreign key error (profile "Delete account", and deleting a
 * team whose bot had created content). Shared team content should outlive its
 * author, so these columns become nullable and are cleared when the user is
 * deleted. The UI shows a null creator as "a deleted user".
 */
return new class extends Migration
{
    /** @var array<string, string> table => column */
    private array $columns = [
        'tasks' => 'created_by',
        'task_dependencies' => 'created_by',
        'task_templates' => 'created_by',
        'task_assignees' => 'assigned_by',
    ];

    public function up(): void
    {
        foreach ($this->columns as $table => $column) {
            Schema::table($table, function (Blueprint $table) use ($column) {
                $table->dropForeign([$column]);
            });

            Schema::table($table, function (Blueprint $table) use ($column) {
                $table->uuid($column)->nullable()->change();
                $table->foreign($column)->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    /**
     * Restores the original restrictive constraints. Rows whose author has
     * since been deleted (null) must be fixed up before rolling back.
     */
    public function down(): void
    {
        foreach ($this->columns as $table => $column) {
            Schema::table($table, function (Blueprint $table) use ($column) {
                $table->dropForeign([$column]);
            });

            Schema::table($table, function (Blueprint $table) use ($column) {
                $table->uuid($column)->nullable(false)->change();
                $table->foreign($column)->references('id')->on('users')->restrictOnDelete();
            });
        }
    }
};
