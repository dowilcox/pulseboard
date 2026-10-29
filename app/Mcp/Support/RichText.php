<?php

namespace App\Mcp\Support;

use App\Mcp\Exceptions\ToolException;
use App\Models\Team;
use App\Models\User;

/**
 * Converts rich text between what agents read/write (Markdown) and what
 * PulseBoard stores.
 *
 * The TipTap editor (tiptap-markdown, html: true) saves descriptions and
 * comments as Markdown with a little inline HTML: mentions are
 * `<span data-type="mention" data-id="…" data-label="…">@Name</span>` and
 * blank lines are `<br>`. Older content may be full HTML. Input is kept as
 * Markdown, exactly like the editor, and the Actions run it through
 * RichTextSanitizer.
 */
class RichText
{
    private const MENTION_TOKEN = '/<@([0-9a-fA-F-]{36})>/';

    private const MENTION_SPAN = '/<span\b(?=[^>]*\bdata-type\s*=\s*["\']mention["\'])[^>]*>(.*?)<\/span>/is';

    /**
     * Prepare agent-supplied Markdown for storage. `<@user-uuid>` tokens
     * become mention spans so MentionParser notifies the mentioned members.
     *
     * @throws ToolException when a mention does not refer to an active team member
     */
    public static function fromMarkdown(?string $markdown, Team $team): ?string
    {
        if ($markdown === null) {
            return null;
        }

        $markdown = str_replace("\0", '', $markdown);

        if (! preg_match_all(self::MENTION_TOKEN, $markdown, $matches)) {
            return $markdown;
        }

        $ids = array_values(array_unique(array_map('strtolower', $matches[1])));

        $members = $team->members()
            ->whereIn('users.id', $ids)
            ->whereNull('deactivated_at')
            ->get(['users.id', 'users.name'])
            ->keyBy(fn (User $user) => strtolower($user->id));

        $unknown = array_diff($ids, $members->keys()->all());

        if ($unknown !== []) {
            throw new ToolException(
                'Cannot mention '.implode(', ', array_map(fn ($id) => "<@{$id}>", $unknown))
                .': not an active member of this team. Use get_board to list members and their ids.'
            );
        }

        return preg_replace_callback(self::MENTION_TOKEN, function (array $match) use ($members) {
            $user = $members->get(strtolower($match[1]));
            $id = e($user->id);
            $label = e($user->name);

            return "<span data-type=\"mention\" data-id=\"{$id}\" data-label=\"{$label}\">@{$label}</span>";
        }, $markdown);
    }

    /**
     * Render stored rich text as readable Markdown-ish text for an LLM.
     */
    public static function toMarkdown(?string $content): ?string
    {
        if ($content === null || trim($content) === '') {
            return null;
        }

        $text = str_replace("\0", '', $content);

        $text = preg_replace_callback(self::MENTION_SPAN, function (array $match) {
            $visible = trim(html_entity_decode(strip_tags($match[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            if ($visible === '' && preg_match('/data-label\s*=\s*["\']([^"\']*)["\']/i', $match[0], $label)) {
                $visible = '@'.ltrim(html_entity_decode($label[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'), '@');
            }

            return $visible;
        }, $text) ?? $text;

        if (preg_match('/<\/?(p|div|h[1-6]|ul|ol|li|blockquote|pre|table|tr)\b/i', $text)) {
            $text = self::htmlToMarkdown($text);
        } else {
            // Markdown from the editor: `<br>` lines are blank paragraphs.
            $text = preg_replace('/<br\s*\/?>/i', "\n", $text) ?? $text;
        }

        $text = preg_replace("/[ \t]+\n/", "\n", $text) ?? $text;
        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

        $text = trim($text);

        return $text === '' ? null : $text;
    }

    /**
     * Plain-text preview (single line), for list outputs.
     */
    public static function preview(?string $content, int $length = 160): ?string
    {
        $text = self::toMarkdown($content);

        if ($text === null) {
            return null;
        }

        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

        return mb_strimwidth($text, 0, $length, '…');
    }

    /**
     * Light HTML → Markdown conversion for legacy HTML content. Not a full
     * converter; it keeps structure (headings, lists, task items, links,
     * code) readable and drops everything else.
     */
    private static function htmlToMarkdown(string $html): string
    {
        $replacements = [
            // Code blocks first so their contents are left alone.
            '/<pre\b[^>]*>\s*<code\b[^>]*>(.*?)<\/code>\s*<\/pre>/is' => fn ($m) => "\n```\n".html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8')."\n```\n",
            '/<h([1-6])\b[^>]*>(.*?)<\/h\1>/is' => fn ($m) => "\n".str_repeat('#', (int) $m[1]).' '.trim($m[2])."\n",
            '/<li\b[^>]*data-checked\s*=\s*["\']true["\'][^>]*>/i' => fn () => "\n- [x] ",
            '/<li\b[^>]*data-checked\s*=\s*["\']false["\'][^>]*>/i' => fn () => "\n- [ ] ",
            '/<li\b[^>]*>/i' => fn () => "\n- ",
            '/<a\b[^>]*href\s*=\s*["\']([^"\']*)["\'][^>]*>(.*?)<\/a>/is' => fn ($m) => '['.trim(strip_tags($m[2])).']('.$m[1].')',
            '/<(strong|b)\b[^>]*>(.*?)<\/\1>/is' => fn ($m) => '**'.$m[2].'**',
            '/<(em|i)\b[^>]*>(.*?)<\/\1>/is' => fn ($m) => '*'.$m[2].'*',
            '/<(del|s)\b[^>]*>(.*?)<\/\1>/is' => fn ($m) => '~~'.$m[2].'~~',
            '/<code\b[^>]*>(.*?)<\/code>/is' => fn ($m) => '`'.$m[1].'`',
            '/<blockquote\b[^>]*>(.*?)<\/blockquote>/is' => fn ($m) => "\n> ".trim(strip_tags($m[1]))."\n",
            '/<img\b[^>]*src\s*=\s*["\']([^"\']*)["\'][^>]*>/i' => fn ($m) => '![]('.$m[1].')',
            '/<br\s*\/?>/i' => fn () => "\n",
            '/<\/(p|div|tr|ul|ol|table)>/i' => fn () => "\n",
            '/<\/(td|th)>/i' => fn () => ' | ',
            '/<input\b[^>]*>/i' => fn () => '',
        ];

        foreach ($replacements as $pattern => $callback) {
            $html = preg_replace_callback($pattern, $callback, $html) ?? $html;
        }

        return html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
