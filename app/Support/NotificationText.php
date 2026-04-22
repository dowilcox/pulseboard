<?php

namespace App\Support;

class NotificationText
{
    public static function toPlainText(?string $content): string
    {
        if ($content === null || $content === '') {
            return '';
        }

        $content = str_replace("\0", '', $content);
        $content = preg_replace('/<((?:https?:|mailto:|tel:)[^<>\s]+)>/i', '$1', $content) ?? $content;
        $content = preg_replace(
            '/<\s*\/?\s*(br|hr|p|div|li|ul|ol|blockquote|h[1-6]|tr|td|th|table)\b[^>]*>/i',
            ' ',
            $content,
        ) ?? $content;

        $plainText = strip_tags($content);
        $plainText = html_entity_decode($plainText, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $plainText = preg_replace('/\x{00A0}/u', ' ', $plainText) ?? $plainText;
        $plainText = preg_replace('/\s+/u', ' ', $plainText) ?? $plainText;

        return trim($plainText);
    }

    public static function preview(?string $content, int $width = 80): string
    {
        $plainText = static::toPlainText($content);

        if ($plainText === '' || mb_strwidth($plainText) <= $width) {
            return $plainText;
        }

        return mb_strimwidth($plainText, 0, $width, '...');
    }
}
