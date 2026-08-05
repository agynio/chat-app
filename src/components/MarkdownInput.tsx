import { useState, type TextareaHTMLAttributes } from 'react';
import { Maximize2 } from 'lucide-react';
import { FullscreenMarkdownEditor } from './FullscreenMarkdownEditor';

interface MarkdownInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'default';
  previewTransform?: (value: string) => string;
}

export function MarkdownInput({
  label,
  error,
  helperText,
  size = 'default',
  className = '',
  value,
  onChange,
  disabled,
  previewTransform,
  ...props
}: MarkdownInputProps) {
  const [showFullscreenEditor, setShowFullscreenEditor] = useState(false);

  const handleFullscreenSave = (newValue: string) => {
    // Create a synthetic event to match the onChange signature
    const syntheticEvent = {
      target: { value: newValue },
      currentTarget: { value: newValue },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange?.(syntheticEvent);
  };

  const paddingClasses = size === 'sm' ? 'px-3 py-2' : 'px-4 py-3';
  const iconPadding = size === 'sm' ? 'pr-10' : 'pr-12';
  const iconPosition = size === 'sm' ? 'right-2 top-2' : 'right-3 top-3';

  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-foreground">
          {label}
        </label>
      )}

      <div className="relative">
        <textarea
          className={`
            w-full ${paddingClasses}
            bg-background 
            border border-border 
            rounded-[10px] 
            text-foreground
            placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            disabled:bg-muted disabled:cursor-not-allowed
            resize-none
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${!disabled ? iconPadding : ''}
            ${className}
          `}
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...props}
        />

        {!disabled && (
          <button
            type="button"
            onClick={() => setShowFullscreenEditor(true)}
            className={`absolute ${iconPosition} p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-[6px] transition-colors z-10`}
            title="Open fullscreen markdown editor"
            tabIndex={-1}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-2 text-sm text-muted-foreground">{helperText}</p>
      )}

      {showFullscreenEditor && (
        <FullscreenMarkdownEditor
          value={String(value || '')}
          onChange={handleFullscreenSave}
          onClose={() => setShowFullscreenEditor(false)}
          label={label || 'Editor'}
          previewTransform={previewTransform}
        />
      )}
    </div>
  );
}
