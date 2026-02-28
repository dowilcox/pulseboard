<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_filters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('board_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->json('filter_config');
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['board_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_filters');
    }
};
