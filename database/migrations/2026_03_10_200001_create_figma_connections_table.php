<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create("figma_connections", function (Blueprint $table) {
            $table->uuid("id")->primary();
            $table
                ->foreignUuid("team_id")
                ->constrained("teams")
                ->cascadeOnDelete();
            $table->string("name");
            $table->text("api_token");
            $table->boolean("is_active")->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists("figma_connections");
    }
};
