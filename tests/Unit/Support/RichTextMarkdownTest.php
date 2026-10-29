<?php

namespace Tests\Unit\Support;

use App\Support\RichTextMarkdown;
use PHPUnit\Framework\TestCase;

class RichTextMarkdownTest extends TestCase
{
    public function test_empty_content_is_null(): void
    {
        $this->assertNull(RichTextMarkdown::toMarkdown(null));
        $this->assertNull(RichTextMarkdown::toMarkdown('   '));
        $this->assertNull(RichTextMarkdown::toMarkdown('<br><br>'));
    }

    public function test_mentions_become_at_names(): void
    {
        $this->assertSame(
            'Thanks @Ada Lovelace!',
            RichTextMarkdown::toMarkdown('Thanks <span data-type="mention" data-id="1" data-label="Ada Lovelace">@Ada Lovelace</span>!'),
        );
    }

    public function test_empty_mention_falls_back_to_its_label(): void
    {
        $this->assertSame(
            'Hi @Bob',
            RichTextMarkdown::toMarkdown('Hi <span data-type="mention" data-id="1" data-label="Bob"></span>'),
        );
    }

    public function test_editor_markdown_keeps_markdown_and_turns_br_into_lines(): void
    {
        $this->assertSame(
            "## Steps\n\n- **one**\n- [two](https://example.com)\n\nSee <https://example.com/docs>",
            RichTextMarkdown::toMarkdown("## Steps\n\n- **one**\n- [two](https://example.com)<br><br><br>See <https://example.com/docs>"),
        );
    }

    public function test_other_tags_are_stripped_but_entities_stay_escaped(): void
    {
        $this->assertSame(
            'Use x and &lt;b&gt;',
            RichTextMarkdown::toMarkdown('Use <u>x</u> and &lt;b&gt;'),
        );
    }

    public function test_code_is_left_untouched(): void
    {
        $markdown = "Use `<div>` here\n\n```html\n<p>keep <span data-type=\"mention\">@x</span></p>\n```";

        $this->assertSame($markdown, RichTextMarkdown::toMarkdown($markdown));
    }

    public function test_legacy_html_is_converted(): void
    {
        $this->assertSame(
            "Hello **world**\n\n- one\n- [x] two\n\n```\n<a>\n```",
            RichTextMarkdown::toMarkdown('<p>Hello <strong>world</strong></p><ul><li>one</li><li data-checked="true">two</li></ul><pre><code>&lt;a&gt;</code></pre>'),
        );
    }

    public function test_excerpt_returns_short_content_unchanged(): void
    {
        $this->assertSame('Short **text**', RichTextMarkdown::excerpt('Short **text**', 50));
    }

    public function test_excerpt_cuts_on_a_word_boundary_with_an_ellipsis(): void
    {
        $this->assertSame(
            'The quick brown…',
            RichTextMarkdown::excerpt('The quick brown fox jumps over the lazy dog', 18),
        );
    }

    public function test_excerpt_prefers_a_line_boundary(): void
    {
        $this->assertSame(
            'First paragraph is here.…',
            RichTextMarkdown::excerpt("First paragraph is here.\n\nSecond paragraph goes on and on", 34),
        );
        $this->assertSame(
            "First line of text\nSecond line of text…",
            RichTextMarkdown::excerpt("First line of text\nSecond line of text\nThird line of text", 45),
        );
    }

    public function test_excerpt_never_cuts_inside_a_tag(): void
    {
        $excerpt = RichTextMarkdown::excerpt(
            'Ping <span data-type="mention" data-id="1" data-label="Ada Lovelace">@Ada Lovelace</span> soon please',
            12,
        );

        $this->assertSame('Ping @Ada…', $excerpt);
    }

    public function test_excerpt_closes_an_open_code_fence_and_inline_code(): void
    {
        $this->assertSame(
            "```\nline of code\nline of code…\n```",
            RichTextMarkdown::excerpt("```\n".str_repeat("line of code\n", 10).'```', 40),
        );
        $this->assertSame(
            'intro `some code with`…',
            RichTextMarkdown::excerpt('intro `some code with spaces inside it` end', 25),
        );
    }
}
