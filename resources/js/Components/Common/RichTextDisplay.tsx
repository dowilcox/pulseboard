import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

const lowlight = createLowlight(common);

interface RichTextDisplayProps {
    content: string;
}

export default function RichTextDisplay({ content }: RichTextDisplayProps) {
    const theme = useTheme();

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
            }),
            Image,
            Link.configure({
                openOnClick: true,
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
        editable: false,
    });

    if (!content || !editor) return null;

    return (
        <Box
            sx={{
                '& .tiptap': {
                    outline: 'none',
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
            <EditorContent editor={editor} />
        </Box>
    );
}
