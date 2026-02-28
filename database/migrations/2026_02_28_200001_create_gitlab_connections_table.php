<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gitlab_connections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('base_url');
            $table->text('api_token');
            $table->text('webhook_secret');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gitlab_connections');
    }
};
