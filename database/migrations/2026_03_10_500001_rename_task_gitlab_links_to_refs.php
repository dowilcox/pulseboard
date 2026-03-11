<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rename table if not already renamed (idempotent for partial failures)
        if (Schema::hasTable('task_gitlab_links')) {
            Schema::rename('task_gitlab_links', 'task_gitlab_refs');
        }

        // Drop gitlab_project_id FK, column, and related index if they still exist
        if (Schema::hasColumn('task_gitlab_refs', 'gitlab_project_id')) {
            Schema::table('task_gitlab_refs', function (Blueprint $table) {
                $table->dropForeign('task_gitlab_links_gitlab_project_id_foreign');
            });

            // Drop the gitlab_project_id + gitlab_iid composite index
            try {
                Schema::table('task_gitlab_refs', function (Blueprint $table) {
                    $table->dropIndex('task_gitlab_links_gitlab_project_id_gitlab_iid_index');
                });
            } catch (Exception) {
                // Index may not exist
            }

            Schema::table('task_gitlab_refs', function (Blueprint $table) {
                $table->dropColumn('gitlab_project_id');
            });
        }

        // Drop old task_id FK so we can drop the composite index it depends on
        DB::statement('ALTER TABLE task_gitlab_refs DROP FOREIGN KEY task_gitlab_links_task_id_foreign');

        // Drop old composite index
        try {
            Schema::table('task_gitlab_refs', function (Blueprint $table) {
                $table->dropIndex('task_gitlab_links_task_id_link_type_index');
            });
        } catch (Exception) {
            // May not exist
        }

        // Re-add task_id FK with new naming
        Schema::table('task_gitlab_refs', function (Blueprint $table) {
            $table->foreign('task_id')->references('id')->on('tasks')->cascadeOnDelete();
        });

        // Rename link_type → ref_type and drop 'issue' value
        DB::statement("ALTER TABLE task_gitlab_refs CHANGE link_type ref_type ENUM('branch', 'merge_request') NOT NULL");

        // Add new composite index
        Schema::table('task_gitlab_refs', function (Blueprint $table) {
            $table->index(['task_id', 'ref_type']);
        });
    }

    public function down(): void
    {
        Schema::table('task_gitlab_refs', function (Blueprint $table) {
            $table->dropIndex(['task_id', 'ref_type']);
        });

        DB::statement("ALTER TABLE task_gitlab_refs CHANGE ref_type link_type ENUM('issue', 'merge_request', 'branch') NOT NULL");

        Schema::table('task_gitlab_refs', function (Blueprint $table) {
            $table->foreignUuid('gitlab_project_id')->nullable()->after('task_id')->constrained()->cascadeOnDelete();
            $table->index(['task_id', 'link_type']);
            $table->index(['gitlab_project_id', 'gitlab_iid']);
        });

        Schema::rename('task_gitlab_refs', 'task_gitlab_links');
    }
};
