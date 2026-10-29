<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Board-level custom field definitions. Task values live in
     * tasks.custom_fields, keyed by the definition id.
     */
    public function up(): void
    {
        Schema::create('board_custom_fields', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('board_id')->constrained('boards')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('type', 20);
            $table->json('options')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('show_on_card')->default(false);
            $table->timestamps();

            $table->index(['board_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('board_custom_fields');
    }
};
