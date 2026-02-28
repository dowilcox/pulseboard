<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('board_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->string('trigger_type');
            $table->json('trigger_config')->default('{}');
            $table->string('action_type');
            $table->json('action_config')->default('{}');
            $table->timestamps();

            $table->index(['board_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_rules');
    }
};
