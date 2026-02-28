import { useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import FormatBold from '@mui/icons-material/FormatBold';
import FormatItalic from '@mui/icons-material/FormatItalic';
import FormatUnderlined from '@mui/icons-material/FormatUnderlined';
import FormatStrikethrough from '@mui/icons-material/FormatStrikethrough';
import Title from '@mui/icons-material/Title';
import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import FormatListNumbered from '@mui/icons-material/FormatListNumbered';
import Checklist from '@mui/icons-material/Checklist';
import CodeIcon from '@mui/icons-material/Code';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import axios from 'axios';

const lowlight = createLowlight(common);

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    editable?: boolean;
    uploadImageUrl?: string;
    minHeight?: number;
}

export default function RichTextEditor({
    content,
    onChange,
    placeholder = 'Write something...',
    editable = true,
    uploadImageUrl,
    minHeight = 200,
}: RichTextEditorProps) {
    const theme = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
            }),
            Image,
            Link.configure({
                openOnClick: false,
            }),
            Placeholder.configure({
                placeholder,
            }),
            Underline,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
        ],
        content,
        editable,
        onUpdate: ({ editor: ed }) => {
            onChange(ed.getHTML());
        },
        editorProps: {
            handlePaste: (_view, event) => {
                const items = event.clipboardData?.items;
                if (!items || !uploadImageUrl) return false;

                for (const item of items) {
                    if (item.type.startsWith('image/')) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (file) uploadImage(file);
                        return true;
                    }
                }
                return false;
            },
        },
    });

    const uploadImage = useCallback(
        async (file: File) => {
            if (!uploadImageUrl || !editor) return;

            const formData = new FormData();
            formData.append('image', file);

            try {
                const response = await axios.post(uploadImageUrl, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const url = response.data.url;
                if (url) {
                    editor.chain().focus().setImage({ src: url }).run();
                }
            } catch (error) {
                console.error('Image upload failed:', error);
            }
        },
        [uploadImageUrl, editor],
    );

    const handleImageButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            uploadImage(file);
            event.target.value = '';
        }
    };

    const handleLinkClick = () => {
        if (!editor) return;

        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter URL:', previousUrl || 'https://');

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    if (!editor) return null;

    const toolbarButton = (
        label: string,
        icon: React.ReactNode,
        action: () => void,
        isActive: boolean,
    ) => (
        <Tooltip title={label} key={label}>
            <IconButton
                size="small"
                onClick={action}
                sx={{
                    color: isActive ? 'primary.main' : 'text.secondary',
                    bgcolor: isActive ? 'action.selected' : 'transparent',
                    borderRadius: 1,
                }}
            >
                {icon}
            </IconButton>
        </Tooltip>
    );

    return (
        <Box
            sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                '&:focus-within': {
                    borderColor: 'primary.main',
                    boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
                },
                '& .tiptap': {
                    p: 2,
                    minHeight,
                    outline: 'none',
                    '& p.is-editor-empty:first-of-type::before': {
                        content: 'attr(data-placeholder)',
                        color: 'text.disabled',
                        float: 'left',
                        height: 0,
                        pointerEvents: 'none',
                    },
                    '& h1': { ...theme.typography.h4, mt: 2, mb: 1 },
                    '& h2': { ...theme.typography.h5, mt: 2, mb: 1 },
                    '& h3': { ...theme.typography.h6, mt: 2, mb: 1 },
                    '& p': { ...theme.typography.body1, my: 0.5 },
                    '& ul, & ol': { pl: 3 },
                    '& ul[data-type="taskList"]': {
                        listStyle: 'none',
                        pl: 0,
                        '& li': {
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1,
                            '& label': {
                                mt: 0.25,
                            },
                            '& input[type="checkbox"]': {
                                accentColor: theme.palette.primary.main,
                                width: 16,
                                height: 16,
                                mt: 0.5,
                            },
                        },
                    },
                    '& pre': {
                        bgcolor: 'action.hover',
                        fontFamily: 'monospace',
                        p: 2,
                        borderRadius: 1,
                        overflow: 'auto',
                        '& code': {
                            background: 'none',
                            p: 0,
                            fontSize: '0.875rem',
                        },
                    },
                    '& code': {
                        bgcolor: 'action.hover',
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                    },
                    '& img': {
                        maxWidth: '100%',
                        borderRadius: '4px',
                    },
                    '& a': {
                        color: 'primary.main',
                        textDecoration: 'underline',
                    },
                    '& blockquote': {
                        borderLeft: 3,
                        borderColor: 'divider',
                        pl: 2,
                        ml: 0,
                        color: 'text.secondary',
                    },
                    '& hr': {
                        borderColor: 'divider',
                        my: 2,
                    },
                },
            }}
        >
            {editable && (
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.25,
                        p: 0.5,
                        bgcolor: 'background.default',
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    {toolbarButton('Bold', <FormatBold fontSize="small" />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
                    {toolbarButton('Italic', <FormatItalic fontSize="small" />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
                    {toolbarButton('Underline', <FormatUnderlined fontSize="small" />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
                    {toolbarButton('Strikethrough', <FormatStrikethrough fontSize="small" />, () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))}
                    {toolbarButton('Heading 1', <Title fontSize="small" />, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
                    {toolbarButton('Heading 2', <Title fontSize="small" sx={{ fontSize: '1.1rem' }} />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
                    {toolbarButton('Heading 3', <Title fontSize="small" sx={{ fontSize: '0.95rem' }} />, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
                    {toolbarButton('Bullet List', <FormatListBulleted fontSize="small" />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
                    {toolbarButton('Ordered List', <FormatListNumbered fontSize="small" />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
                    {toolbarButton('Task List', <Checklist fontSize="small" />, () => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList'))}
                    {toolbarButton('Code Block', <CodeIcon fontSize="small" />, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
                    {toolbarButton('Link', <LinkIcon fontSize="small" />, handleLinkClick, editor.isActive('link'))}
                    {uploadImageUrl && toolbarButton('Image', <ImageIcon fontSize="small" />, handleImageButtonClick, false)}
                </Box>
            )}
            <EditorContent editor={editor} />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </Box>
    );
}
