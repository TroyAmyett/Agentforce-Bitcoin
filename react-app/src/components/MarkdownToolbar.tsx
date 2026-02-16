import React from 'react';
import { Bold, Italic, Link, ImageIcon, Video, List, Heading3 } from 'lucide-react';

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (newValue: string) => void;
}

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: MarkdownToolbarProps) {
  const insert = (
    before: string,
    after: string = '',
    placeholder?: string,
  ) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end) || placeholder || '';
    const newValue =
      value.substring(0, start) + before + selected + after + value.substring(end);
    onChange(newValue);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    }, 0);
  };

  return (
    <div className="sp-md-toolbar">
      <button
        type="button"
        title="Bold"
        onClick={() => insert('**', '**', 'bold text')}
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        title="Italic"
        onClick={() => insert('*', '*', 'italic text')}
      >
        <Italic size={14} />
      </button>
      <button
        type="button"
        title="Link"
        onClick={() => insert('[', '](url)', 'link text')}
      >
        <Link size={14} />
      </button>
      <button
        type="button"
        title="Image URL"
        onClick={() => insert('![', '](image-url)', 'alt text')}
      >
        <ImageIcon size={14} />
      </button>
      <button
        type="button"
        title="YouTube / Video URL"
        onClick={() =>
          insert('\n', '\n', 'https://youtube.com/watch?v=VIDEO_ID')
        }
      >
        <Video size={14} />
      </button>
      <button
        type="button"
        title="Bullet List"
        onClick={() => insert('\n- ', '', 'item')}
      >
        <List size={14} />
      </button>
      <button
        type="button"
        title="Heading"
        onClick={() => insert('\n### ', '', 'Heading')}
      >
        <Heading3 size={14} />
      </button>
    </div>
  );
}
