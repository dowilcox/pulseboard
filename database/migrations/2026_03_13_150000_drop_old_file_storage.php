<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('attachments');

        if (Schema::hasColumn('boards', 'image_path')) {
            Schema::table('boards', function (Blueprint $table) {
                $table->dropColumn('image_path');
            });
        }

        if (Schema::hasColumn('teams', 'image_path')) {
            Schema::table('teams', function (Blueprint $table) {
                $table->dropColumn('image_path');
            });
        }
    }

    public function down(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('task_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->restrictOnDelete();
            $table->string('filename');
            $table->string('file_path');
            $table->integer('file_size');
            $table->string('mime_type');
            $table->timestamp('created_at');
        });

        Schema::table('boards', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('description');
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('description');
        });
    }
};
