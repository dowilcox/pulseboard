<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the old table if it exists (from before the rename)
        Schema::dropIfExists('task_gitlab_links');

        // Drop and recreate with the correct schema to avoid FK/index issues
        Schema::dropIfExists('task_gitlab_refs');

        Schema::create('task_gitlab_refs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('task_id')->constrained()->cascadeOnDelete();
            $table->enum('ref_type', ['merge_request', 'branch']);
            $table->unsignedBigInteger('gitlab_iid')->nullable();
            $table->string('gitlab_ref')->nullable();
            $table->string('title')->nullable();
            $table->string('state')->nullable();
            $table->string('url');
            $table->string('pipeline_status')->nullable();
            $table->string('author')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->index(['task_id', 'ref_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_gitlab_refs');
    }
};
