<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignUuid('gitlab_project_id')
                ->nullable()
                ->after('parent_task_id')
                ->constrained('gitlab_projects')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['gitlab_project_id']);
            $table->dropColumn('gitlab_project_id');
        });
    }
};
