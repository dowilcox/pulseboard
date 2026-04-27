<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('users')->update(['theme_preference' => 'dark']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Dark is now the only supported app theme.
    }
};
