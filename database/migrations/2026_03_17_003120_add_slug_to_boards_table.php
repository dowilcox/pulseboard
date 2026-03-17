<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
        });

        // Backfill existing boards with slugs unique within each team
        $boards = DB::table('boards')->orderBy('created_at')->get();
        $usedSlugs = []; // keyed by team_id

        foreach ($boards as $board) {
            $slug = Str::slug($board->name);
            $originalSlug = $slug;
            $counter = 1;

            $teamSlugs = $usedSlugs[$board->team_id] ?? [];

            while (in_array($slug, $teamSlugs)) {
                $slug = "{$originalSlug}-{$counter}";
                $counter++;
            }

            $usedSlugs[$board->team_id][] = $slug;

            DB::table('boards')->where('id', $board->id)->update(['slug' => $slug]);
        }

        Schema::table('boards', function (Blueprint $table) {
            $table->string('slug')->nullable(false)->change();
            $table->unique(['team_id', 'slug']);
        });
    }

    public function down(): void
    {
        Schema::table('boards', function (Blueprint $table) {
            $table->dropUnique(['team_id', 'slug']);
            $table->dropColumn('slug');
        });
    }
};
