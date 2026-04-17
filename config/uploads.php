<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Allowed Image Types
    |--------------------------------------------------------------------------
    |
    | File extensions allowed for image uploads (avatars, editor images).
    | SVG is excluded by default because it can contain embedded JavaScript.
    |
    | Env: UPLOAD_IMAGE_TYPES (comma-separated extensions)
    |
    */
    'image_types' => explode(',', env('UPLOAD_IMAGE_TYPES', 'jpg,jpeg,png,gif,webp')),

    /*
    |--------------------------------------------------------------------------
    | Allowed Attachment Types
    |--------------------------------------------------------------------------
    |
    | File extensions allowed for task attachment uploads. This is the default
    | set of safe, commonly used file types.
    |
    | Env: UPLOAD_ATTACHMENT_TYPES (comma-separated extensions)
    |
    | To allow a broader set of file types, set the env variable to:
    | UPLOAD_ATTACHMENT_TYPES=jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,7z,tar,gz,mp4,webm,mp3,ogg,wav,json,yaml,yml,md,rtf,odt,ods,odp,bmp,tiff,ico,avi,mov
    |
    */
    'attachment_types' => array_map('trim', explode(',', env(
        'UPLOAD_ATTACHMENT_TYPES',
        'jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,mp4,webm'
    ))),

    /*
    |--------------------------------------------------------------------------
    | Extension -> MIME type map
    |--------------------------------------------------------------------------
    |
    | Canonical MIME types used to enforce that the uploaded file's detected
    | MIME type matches its extension. This is defense-in-depth on top of the
    | extension whitelist: validation requires BOTH the extension AND the
    | detected MIME type to appear in the allowed set for the request.
    |
    */
    'mime_types' => [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'bmp' => 'image/bmp',
        'tiff' => 'image/tiff',
        'ico' => 'image/vnd.microsoft.icon',
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt' => 'application/vnd.ms-powerpoint',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'odt' => 'application/vnd.oasis.opendocument.text',
        'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
        'odp' => 'application/vnd.oasis.opendocument.presentation',
        'rtf' => 'application/rtf',
        'txt' => 'text/plain',
        'md' => 'text/markdown',
        'csv' => 'text/csv',
        'json' => 'application/json',
        'yaml' => 'application/yaml',
        'yml' => 'application/yaml',
        'zip' => 'application/zip',
        '7z' => 'application/x-7z-compressed',
        'tar' => 'application/x-tar',
        'gz' => 'application/gzip',
        'mp4' => 'video/mp4',
        'webm' => 'video/webm',
        'mov' => 'video/quicktime',
        'avi' => 'video/x-msvideo',
        'mp3' => 'audio/mpeg',
        'ogg' => 'audio/ogg',
        'wav' => 'audio/wav',
    ],

    /*
    |--------------------------------------------------------------------------
    | Max File Sizes (KB)
    |--------------------------------------------------------------------------
    |
    | Maximum upload sizes in kilobytes for each upload category.
    |
    */
    'max_size' => [
        'attachment' => (int) env('UPLOAD_MAX_ATTACHMENT_KB', 15360),    // 15MB
        'editor_image' => (int) env('UPLOAD_MAX_EDITOR_IMAGE_KB', 5120), // 5MB
        'avatar' => (int) env('UPLOAD_MAX_AVATAR_KB', 2048),             // 2MB
    ],

];
