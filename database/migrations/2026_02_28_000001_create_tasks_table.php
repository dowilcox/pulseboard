<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('board_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('column_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('parent_task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->unsignedInteger('task_number')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('priority', ['urgent', 'high', 'medium', 'low', 'none'])->default('none');
            $table->float('sort_order')->default(0);
            $table->date('due_date')->nullable();
            $table->integer('effort_estimate')->nullable();
            $table->json('custom_fields')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('checklists')->nullable();
            $table->json('recurrence_config')->nullable();
            $table->timestamp('recurrence_next_at')->nullable();
            $table->foreignUuid('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['board_id', 'task_number']);
            $table->index(['board_id', 'column_id', 'sort_order']);
            $table->index('parent_task_id');
            $table->index('due_date');
            $table->index('updated_at');
            $table->index('recurrence_next_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
