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
    'attachment_types' => explode(',', env(
        'UPLOAD_ATTACHMENT_TYPES',
        'jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,mp4,webm'
    )),

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
