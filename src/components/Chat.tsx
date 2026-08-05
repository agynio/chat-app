import { memo, useCallback, useEffect, useRef, type MutableRefObject, type ReactNode, type Ref, type UIEvent } from 'react';
import { Message, type MessageRole } from './Message';
import { QueuedMessage } from './QueuedMessage';
import { Reminder } from './Reminder';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: ReactNode;
  timestamp?: string;
  senderLabel?: string;
  isUnread?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
  traceUrl?: string;
}

export interface ChatRun {
  id: string;
  messages: ChatMessage[];
}

export interface ChatQueuedMessageData {
  id: string;
  content: ReactNode;
}

export interface ChatReminderData {
  id: string;
  content: ReactNode;
  scheduledTime: string;
  date?: string;
}

interface ChatProps {
  runs: ChatRun[];
  queuedMessages?: ChatQueuedMessageData[];
  reminders?: ChatReminderData[];
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  scrollRef?: Ref<HTMLDivElement>;
  /** Space kept clear at the end for a composer floating over the transcript. */
  bottomInset?: number;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  onCancelQueuedMessage?: (queuedMessageId: string) => void;
  onCancelReminder?: (reminderId: string) => void;
  isCancelQueuedMessagesPending?: boolean;
  cancellingReminderIds?: ReadonlySet<string>;
}

const EMPTY_QUEUED_MESSAGES: ChatQueuedMessageData[] = [];
const EMPTY_REMINDERS: ChatReminderData[] = [];
const EMPTY_HEADER: ReactNode = null;
const EMPTY_FOOTER: ReactNode = null;
const EMPTY_REMINDER_IDS: ReadonlySet<string> = new Set();

function ChatImpl({
  runs,
  queuedMessages = EMPTY_QUEUED_MESSAGES,
  reminders = EMPTY_REMINDERS,
  header = EMPTY_HEADER,
  footer = EMPTY_FOOTER,
  className = '',
  scrollRef,
  bottomInset = 0,
  onScroll,
  onCancelQueuedMessage,
  onCancelReminder,
  isCancelQueuedMessagesPending = false,
  cancellingReminderIds = EMPTY_REMINDER_IDS,
}: ChatProps) {
  const hasQueueOrReminders = queuedMessages.length > 0 || reminders.length > 0;

  const scrollNodeRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);

  const attachScrollNode = useCallback(
    (node: HTMLDivElement | null) => {
      scrollNodeRef.current = node;
      if (typeof scrollRef === 'function') {
        scrollRef(node);
      } else if (scrollRef) {
        (scrollRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [scrollRef],
  );

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const node = event.currentTarget;
      isAtBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
      onScroll?.(event);
    },
    [onScroll],
  );

  // A growing composer eats into the transcript from below, so re-pin whoever
  // was already reading the end of it.
  useEffect(() => {
    const node = scrollNodeRef.current;
    if (node && isAtBottomRef.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [bottomInset]);

  return (
    <div
      className={`flex flex-col h-full bg-card rounded-[10px] border border-border overflow-hidden ${className}`}
      data-testid="chat"
    >
      {/* Header */}
      {header && (
        <div className="px-6 py-4 border-b border-border bg-muted">
          {header}
        </div>
      )}

      {/* Main Content Area - Single Scroll Container */}
      <div
        className="flex-1 min-w-0 overflow-y-auto flex flex-col"
        style={{ paddingBottom: bottomInset }}
        ref={attachScrollNode}
        onScroll={handleScroll}
        data-testid="chat-scroll"
      >
        {/* Runs Container */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Runs */}
          {runs.map((run, index) => (
            <div key={run.id} className="min-w-0">
              {index > 0 && <div className="border-t border-border" />}
              <div className="min-w-0 px-6 pt-6 pb-2">
                {run.messages.map((message) => (
                    <Message
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      timestamp={message.timestamp}
                      senderLabel={message.senderLabel}
                      isUnread={message.isUnread}
                      showDelete={message.showDelete}
                      onDelete={message.onDelete}
                      traceUrl={message.traceUrl}
                    />
                  ))}
              </div>
            </div>
          ))}

          {/* Queue and Reminders Section */}
          {hasQueueOrReminders && (
            <div className="min-w-0 px-6 pb-6">
              <div className="pt-6 min-w-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 border-t border-border" />
                  <span className="text-xs text-muted-foreground tracking-wider">PENDING</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                <div className="space-y-3">
                  {queuedMessages.map((msg) => (
                    <QueuedMessage
                      key={msg.id}
                      content={msg.content}
                      onCancel={onCancelQueuedMessage ? () => onCancelQueuedMessage(msg.id) : undefined}
                      isCancelling={isCancelQueuedMessagesPending}
                    />
                  ))}

                  {reminders.map((reminder) => (
                    <Reminder
                      key={reminder.id}
                      content={reminder.content}
                      scheduledTime={reminder.scheduledTime}
                      date={reminder.date}
                      onCancel={onCancelReminder ? () => onCancelReminder(reminder.id) : undefined}
                      isCancelling={cancellingReminderIds.has(reminder.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1" />
        </div>
      </div>

      {/* Footer */}
      {footer && (
        <div className="px-6 py-4 border-t border-border bg-muted">
          {footer}
        </div>
      )}
    </div>
  );
}

function areEqual(prev: ChatProps, next: ChatProps): boolean {
  return (
    prev.runs === next.runs &&
    prev.queuedMessages === next.queuedMessages &&
    prev.reminders === next.reminders &&
    prev.header === next.header &&
    prev.footer === next.footer &&
    prev.className === next.className &&
    prev.scrollRef === next.scrollRef &&
    prev.bottomInset === next.bottomInset &&
    prev.onScroll === next.onScroll &&
    prev.onCancelQueuedMessage === next.onCancelQueuedMessage &&
    prev.onCancelReminder === next.onCancelReminder &&
    prev.isCancelQueuedMessagesPending === next.isCancelQueuedMessagesPending &&
    prev.cancellingReminderIds === next.cancellingReminderIds
  );
}

export const Chat = memo(ChatImpl, areEqual);
