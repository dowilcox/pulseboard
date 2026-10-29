<?php

namespace App\Support;

/**
 * Turns stored rich text into clean Markdown for places outside PulseBoard
 * (for example GitLab merge request descriptions).
 *
 * The TipTap editor (tiptap-markdown, html: true) saves descriptions and
 * comments as Markdown with a little inline HTML: mentions are
 * `<span data-type="mention" data-id="…" data-label="…">@Name</span>` and
 * blank lines are `<br>`. Older content may be full HTML. Code spans and
 * fenced code blocks are left untouched.
 *
 * Mirrors App\Mcp\Support\RichText::toMarkdown() on the MCP branch; the two
 * should be merged into one helper.
 */
class RichTextMarkdown
{
    private const MENTION_SPAN = '/<span\b(?=[^>]*\bdata-type\s*=\s*["\']mention["\'])[^>]*>(.*?)<\/span>/is';

    /** Fenced code blocks and inline code spans, which must not be rewritten. */
    private const CODE = '/(^|\n)(```|~~~)[^\n]*\n.*?(\n\2[^\S\n]*(?=\n|$)|$)|`[^`\n]+`/s';

    public static function toMarkdown(?string $content): ?string
    {
        if ($content === null || trim($content) === '') {
            return null;
        }

        $text = str_replace(["\0", "\r\n"], ['', "\n"], $content);

        // Set code aside so tags shown inside it survive.
        $code = [];
        $text = preg_replace_callback(self::CODE, function (array $match) use (&$code) {
            return self::stash($code, $match[0]);
        }, $text) ?? $text;

        $text = preg_replace_callback(self::MENTION_SPAN, function (array $match) {
            $visible = trim(self::decode(strip_tags($match[1])));

            if ($visible === '' && preg_match('/data-label\s*=\s*["\']([^"\']*)["\']/i', $match[0], $label)) {
                $visible = '@'.ltrim(self::decode($label[1]), '@');
            }

            return $visible;
        }, $text) ?? $text;

        // Autolinks (<https://…>) are Markdown, not tags.
        $text = preg_replace('/<((?:https?:|mailto:)[^<>\s]+)>/i', "\u{E002}$1\u{E003}", $text) ?? $text;

        // Entities are left encoded: Markdown renders them, and decoding
        // `&lt;tag&gt;` would turn escaped text into live HTML.
        $text = preg_match('/<\/?(p|div|h[1-6]|ul|ol|li|blockquote|pre|table|tr)\b/i', $text)
            ? self::htmlToMarkdown($text, $code)
            : strip_tags(preg_replace('/<br\s*\/?>/i', "\n", $text) ?? $text);

        $text = str_replace(['&nbsp;', "\u{00A0}"], ' ', $text);

        $text = str_replace(["\u{E002}", "\u{E003}"], ['<', '>'], $text);
        $text = preg_replace_callback("/\u{E000}(\\d+)\u{E001}/u", fn ($m) => $code[(int) $m[1]] ?? '', $text) ?? $text;

        $text = preg_replace("/[ \t]+\n/", "\n", $text) ?? $text;
        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;
        $text = trim($text);

        return $text === '' ? null : $text;
    }

    /**
     * Markdown cut to at most $limit characters (plus an ellipsis), on a line
     * or word boundary, never inside a tag, and with an unterminated code
     * fence closed.
     */
    public static function excerpt(?string $content, int $limit): ?string
    {
        $text = self::toMarkdown($content);

        if ($text === null || mb_strlen($text) <= $limit) {
            return $text;
        }

        $cut = mb_substr($text, 0, $limit + 1);

        // Prefer the last line break in the back half, then the last space.
        $lineBreak = mb_strrpos($cut, "\n");
        $space = max((int) mb_strrpos($cut, ' '), (int) mb_strrpos($cut, "\t"));

        if ($lineBreak !== false && $lineBreak >= $limit / 2) {
            $cut = mb_substr($cut, 0, $lineBreak);
        } elseif ($space > 0) {
            $cut = mb_substr($cut, 0, $space);
        } else {
            $cut = mb_substr($cut, 0, $limit);
        }

        $cut = rtrim($cut);

        // Close an inline code span the cut left open on the last line.
        $lastLine = mb_substr($cut, (int) mb_strrpos("\n".$cut, "\n"));
        if (! preg_match('/^(```|~~~)/', $lastLine) && substr_count($lastLine, '`') % 2 === 1) {
            $cut .= '`';
        }

        $cut .= "\u{2026}";

        // An odd number of fence lines means the excerpt ends inside a code block.
        if (preg_match_all('/^(```|~~~)/m', $cut) % 2 === 1) {
            $cut .= "\n```";
        }

        return $cut;
    }

    /**
     * Set a code snippet aside behind a placeholder until the end.
     *
     * @param  list<string>  $code
     */
    private static function stash(array &$code, string $snippet): string
    {
        $code[] = $snippet;

        return "\u{E000}".(count($code) - 1)."\u{E001}";
    }

    private static function decode(string $text): string
    {
        return html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Light HTML → Markdown conversion for legacy HTML content. Keeps
     * headings, lists, task items, links, emphasis and code readable and
     * drops every other tag.
     *
     * @param  list<string>  $code
     */
    private static function htmlToMarkdown(string $html, array &$code): string
    {
        $replacements = [
            // Code is decoded and set aside, so `&lt;tag&gt;` in it survives strip_tags().
            '/<pre\b[^>]*>\s*<code\b[^>]*>(.*?)<\/code>\s*<\/pre>/is' => function ($m) use (&$code) {
                return "\n".self::stash($code, "```\n".self::decode(strip_tags($m[1]))."\n```")."\n";
            },
            '/<h([1-6])\b[^>]*>(.*?)<\/h\1>/is' => fn ($m) => "\n".str_repeat('#', (int) $m[1]).' '.trim($m[2])."\n",
            '/<li\b[^>]*data-checked\s*=\s*["\']true["\'][^>]*>/i' => fn () => "\n- [x] ",
            '/<li\b[^>]*data-checked\s*=\s*["\']false["\'][^>]*>/i' => fn () => "\n- [ ] ",
            '/<li\b[^>]*>/i' => fn () => "\n- ",
            '/<a\b[^>]*href\s*=\s*["\']([^"\']*)["\'][^>]*>(.*?)<\/a>/is' => fn ($m) => '['.trim(strip_tags($m[2])).']('.$m[1].')',
            '/<(strong|b)\b[^>]*>(.*?)<\/\1>/is' => fn ($m) => '**'.$m[2].'**',
            '/<(em|i)\b[^>]*>(.*?)<\/\1>/is' => fn ($m) => '*'.$m[2].'*',
            '/<(del|s)\b[^>]*>(.*?)<\/\1>/is' => fn ($m) => '~~'.$m[2].'~~',
            '/<code\b[^>]*>(.*?)<\/code>/is' => function ($m) use (&$code) {
                return self::stash($code, '`'.self::decode(strip_tags($m[1])).'`');
            },
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

        return strip_tags($html);
    }
}
