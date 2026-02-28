<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_gitlab_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('task_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('gitlab_project_id')->constrained()->cascadeOnDelete();
            $table->enum('link_type', ['issue', 'merge_request', 'branch']);
            $table->unsignedBigInteger('gitlab_iid')->nullable();
            $table->string('gitlab_ref')->nullable();
            $table->string('title')->nullable();
            $table->string('state')->nullable();
            $table->string('url');
            $table->string('pipeline_status')->nullable();
            $table->string('author')->nullable();
            $table->json('meta')->default('{}');
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->index(['task_id', 'link_type']);
            $table->index(['gitlab_project_id', 'gitlab_iid']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_gitlab_links');
    }
};
