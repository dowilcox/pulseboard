<?php

namespace App\Support;

class RichTextSanitizer
{
    private const VOID_TAGS = ['br', 'hr', 'img', 'input'];

    private const ALLOWED_TAGS = [
        'a' => ['href', 'target', 'rel'],
        'blockquote' => [],
        'br' => [],
        'code' => [],
        'del' => [],
        'div' => [],
        'em' => [],
        'h1' => [],
        'h2' => [],
        'h3' => [],
        'h4' => [],
        'h5' => [],
        'h6' => [],
        'hr' => [],
        'img' => ['src', 'alt', 'title'],
        'input' => ['type', 'checked'],
        'label' => [],
        'li' => ['data-type', 'data-checked'],
        'ol' => [],
        'p' => [],
        'pre' => [],
        's' => [],
        'span' => ['data-type', 'data-id', 'data-label'],
        'strong' => [],
        'table' => [],
        'tbody' => [],
        'td' => [],
        'th' => [],
        'thead' => [],
        'tr' => [],
        'u' => [],
        'ul' => ['data-type'],
    ];

    public static function sanitize(?string $content): ?string
    {
        if ($content === null || $content === '') {
            return $content;
        }

        $content = str_replace("\0", '', $content);
        $content = preg_replace(
            '/<\s*(script|style|iframe|object|embed|meta|link|base)\b[^>]*>.*?<\s*\/\s*\1\s*>/is',
            '',
            $content,
        ) ?? $content;
        $content = preg_replace('/<!--.*?-->/s', '', $content) ?? $content;

        return preg_replace_callback(
            '/<\s*(\/?)\s*([a-zA-Z0-9:-]+)([^>]*)>/s',
            static function (array $matches): string {
                $closing = $matches[1] === '/';
                $tag = strtolower($matches[2]);

                if (! isset(self::ALLOWED_TAGS[$tag])) {
                    return '';
                }

                if ($closing) {
                    return in_array($tag, self::VOID_TAGS, true) ? '' : "</{$tag}>";
                }

                $attributes = self::sanitizeAttributes($tag, $matches[3] ?? '');
                $attributeString = $attributes === [] ? '' : ' '.implode(' ', $attributes);

                return "<{$tag}{$attributeString}>";
            },
            $content,
        ) ?? $content;
    }

    private static function sanitizeAttributes(string $tag, string $rawAttributes): array
    {
        preg_match_all(
            '/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'=<>`]+)))?/',
            $rawAttributes,
            $matches,
            PREG_SET_ORDER,
        );

        $allowedAttributes = self::ALLOWED_TAGS[$tag];
        $attributes = [];

        foreach ($matches as $match) {
            $name = strtolower($match[1]);
            $value = $match[2] ?? $match[3] ?? $match[4] ?? '';

            if (! in_array($name, $allowedAttributes, true)) {
                continue;
            }

            if ($tag === 'a' && $name === 'href') {
                if (! self::isSafeUrl($value)) {
                    continue;
                }
            }

            if ($tag === 'img' && $name === 'src') {
                if (! self::isSafeUrl($value)) {
                    continue;
                }
            }

            if ($tag === 'a' && $name === 'target') {
                if (! in_array($value, ['_blank', '_self'], true)) {
                    continue;
                }
            }

            if ($tag === 'input') {
                if ($name === 'type' && strtolower($value) !== 'checkbox') {
                    continue;
                }

                if ($name === 'checked' && ! in_array(strtolower($value), ['', 'checked', 'true'], true)) {
                    continue;
                }
            }

            if (str_starts_with($name, 'on')) {
                continue;
            }

            if ($value === '' && $name === 'checked') {
                $attributes[] = 'checked';

                continue;
            }

            $attributes[] = sprintf(
                '%s="%s"',
                $name,
                htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
            );
        }

        if ($tag === 'a') {
            $hasTargetBlank = in_array('target="_blank"', $attributes, true);
            if ($hasTargetBlank && ! in_array('rel="noopener noreferrer"', $attributes, true)) {
                $attributes[] = 'rel="noopener noreferrer"';
            }
        }

        if ($tag === 'input') {
            if (! in_array('type="checkbox"', $attributes, true)) {
                return [];
            }

            $attributes[] = 'disabled';
        }

        return array_values(array_unique($attributes));
    }

    private static function isSafeUrl(string $value): bool
    {
        $value = trim(html_entity_decode($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));

        if ($value === '' || str_starts_with($value, '#') || str_starts_with($value, '/')) {
            return true;
        }

        return preg_match('/^(https?:|mailto:|tel:)/i', $value) === 1;
    }
}
