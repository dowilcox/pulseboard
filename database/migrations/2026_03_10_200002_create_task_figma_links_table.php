<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create("task_figma_links", function (Blueprint $table) {
            $table->uuid("id")->primary();
            $table->foreignUuid("task_id")->constrained()->cascadeOnDelete();
            $table
                ->foreignUuid("figma_connection_id")
                ->constrained()
                ->cascadeOnDelete();
            $table->string("file_key");
            $table->string("node_id")->nullable();
            $table->string("name");
            $table->string("url");
            $table->string("thumbnail_url", 2048)->nullable();
            $table->timestamp("last_modified_at")->nullable();
            $table->json("meta")->nullable();
            $table->timestamp("last_synced_at")->nullable();
            $table->timestamps();

            $table->index("task_id");
            $table->index(["figma_connection_id", "file_key"]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists("task_figma_links");
    }
};
