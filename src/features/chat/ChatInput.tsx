import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { AutosizeTextarea } from '@/components/AutosizeTextarea';
import { Button } from '@/components/Button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

export function ChatInput({ onSend, disabled = false, isSending = false }: ChatInputProps) {
  const [value, setValue] = useState('');
  const trimmedValue = value.trim();
  const canSend = trimmedValue.length > 0 && !disabled && !isSending;

  const handleSend = () => {
    if (!canSend) return;
    onSend(trimmedValue);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    handleSend();
  };

  return (
    <div className="flex items-end gap-3">
      <AutosizeTextarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        minLines={1}
        maxLines={6}
        disabled={disabled}
        className="text-sm"
      />
      <Button
        size="sm"
        variant="primary"
        onClick={handleSend}
        disabled={!canSend}
        className="h-9 px-3"
      >
        <Send className="h-4 w-4" />
        <span className="ml-2">Send</span>
      </Button>
    </div>
  );
}
