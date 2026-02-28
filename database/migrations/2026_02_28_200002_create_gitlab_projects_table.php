<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gitlab_projects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('gitlab_connection_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('gitlab_project_id');
            $table->string('name');
            $table->string('path_with_namespace');
            $table->string('default_branch')->default('main');
            $table->string('web_url');
            $table->unsignedBigInteger('webhook_id')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'gitlab_project_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gitlab_projects');
    }
};
