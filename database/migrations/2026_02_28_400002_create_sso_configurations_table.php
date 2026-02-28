<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sso_configurations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider')->default('saml2');
            $table->string('name');
            $table->string('entity_id');
            $table->string('login_url');
            $table->string('logout_url')->nullable();
            $table->text('certificate');
            $table->string('metadata_url')->nullable();
            $table->json('attribute_mapping')->nullable();
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sso_configurations');
    }
};
