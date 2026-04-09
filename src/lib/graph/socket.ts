// CI trigger: no-op comment to touch UI file
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { getAccessToken, userManager } from '@/auth';
import { getSocketBaseUrl, getSocketsEnabled } from '@/config';
import type { NodeStatusEvent, ReminderCountEvent } from './types';

// Strictly typed server-to-client socket events (listener signatures)
type NodeStateEvent = { nodeId: string; state: Record<string, unknown>; updatedAt: string };
type ChatSummary = { id: string; alias: string; summary: string | null; status: 'open' | 'closed'; createdAt: string; parentId?: string | null };
type MessageSummary = { id: string; kind: 'user' | 'assistant' | 'system' | 'tool'; text: string | null; source: unknown; createdAt: string; runId?: string };
type ServerRunSummary = {
  id: string;
  conversationId?: string;
  status: 'running' | 'finished' | 'terminated';
  createdAt: string;
  updatedAt: string;
};
type ChatRunSummary = {
  id: string;
  chatId?: string;
  status: 'running' | 'finished' | 'terminated';
  createdAt: string;
  updatedAt: string;
};
type ServerChatCreatedPayload = { conversation: ChatSummary };
type ServerChatUpdatedPayload = { conversation: ChatSummary };
type ServerChatActivityPayload = { conversationId: string; activity: 'working' | 'waiting' | 'idle' };
type ServerChatRemindersPayload = { conversationId: string; remindersCount: number };
type ServerMessageCreatedPayload = { conversationId: string; message: MessageSummary };
type ServerRunStatusChangedPayload = { conversationId: string; run: ServerRunSummary };
interface ServerToClientEvents {
  node_status: (payload: NodeStatusEvent) => void;
  node_state: (payload: NodeStateEvent) => void;
  node_reminder_count: (payload: ReminderCountEvent) => void;
  conversation_created: (payload: ServerChatCreatedPayload) => void;
  conversation_updated: (payload: ServerChatUpdatedPayload) => void;
  conversation_activity_changed: (payload: ServerChatActivityPayload) => void;
  conversation_reminders_count: (payload: ServerChatRemindersPayload) => void;
  message_created: (payload: ServerMessageCreatedPayload) => void;
  run_status_changed: (payload: ServerRunStatusChangedPayload) => void;
}
// Client-to-server emits: subscribe to rooms
type SubscribePayload = { room?: string; rooms?: string[] };
interface ClientToServerEvents { subscribe: (payload: SubscribePayload) => void }

type Listener = (ev: NodeStatusEvent) => void;
type StateListener = (ev: { nodeId: string; state: Record<string, unknown>; updatedAt: string }) => void;
type ReminderListener = (ev: ReminderCountEvent) => void;
type ChatCreatedPayload = { chat: ChatSummary };
type ChatUpdatedPayload = { chat: ChatSummary };
type ChatActivityPayload = { chatId: string; activity: 'working' | 'waiting' | 'idle' };
type ChatRemindersPayload = { chatId: string; remindersCount: number };
type ChatMessageCreatedPayload = { message: MessageSummary; chatId: string };
type ChatRunStatusChangedPayload = { chatId: string; run: ChatRunSummary };

const socketsEnabled = getSocketsEnabled();

class GraphSocket {
  // Typed socket instance; null until connected
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private stateListeners = new Map<string, Set<StateListener>>();
  private reminderListeners = new Map<string, Set<ReminderListener>>();
  private chatCreatedListeners = new Set<(payload: ChatCreatedPayload) => void>();
  private chatUpdatedListeners = new Set<(payload: ChatUpdatedPayload) => void>();
  private chatActivityListeners = new Set<(payload: ChatActivityPayload) => void>();
  private chatRemindersListeners = new Set<(payload: ChatRemindersPayload) => void>();
  private chatMessageCreatedListeners = new Set<(payload: ChatMessageCreatedPayload) => void>();
  private chatRunStatusListeners = new Set<(payload: ChatRunStatusChangedPayload) => void>();
  private subscribedRooms = new Set<string>();
  private connectCallbacks = new Set<() => void>();
  private reconnectCallbacks = new Set<() => void>();
  private disconnectCallbacks = new Set<() => void>();
  private socketCleanup: Array<() => void> = [];
  private managerCleanup: Array<() => void> = [];

  private emitSubscriptions(rooms: string[]) {
    if (!rooms.length) return;
    const sock = this.socket;
    if (!sock || !sock.connected) return;
    sock.emit('subscribe', { rooms });
  }

  private resubscribeAll() {
    if (!this.socket || this.subscribedRooms.size === 0) return;
    this.emitSubscriptions(Array.from(this.subscribedRooms));
  }

  connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket) return this.socket;
    const host = getSocketBaseUrl();
    // Cast to typed Socket to enable event payload typing
    const transports: ManagerOptions['transports'] = ['websocket'];
    const auth: SocketOptions['auth'] | undefined = userManager
      ? (callback) => {
          void getAccessToken().then((token) => {
            callback(token ? { token } : {});
          });
        }
      : undefined;
    const options: Partial<ManagerOptions & SocketOptions> = {
      path: '/socket.io',
      transports,
      forceNew: false,
      autoConnect: socketsEnabled,
      timeout: socketsEnabled ? 10000 : 1,
      reconnection: socketsEnabled,
      reconnectionAttempts: socketsEnabled ? Infinity : 0,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: false,
    };
    if (auth) options.auth = auth;
    this.socketCleanup = [];
    this.managerCleanup = [];

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(host, options);
    this.socket = socket;

    const manager = socket.io;

    const handleConnect = () => {
      this.resubscribeAll();
      for (const fn of this.connectCallbacks) fn();
    };
    const handleReconnect = () => {
      this.resubscribeAll();
      for (const fn of this.reconnectCallbacks) fn();
    };
    const handleDisconnect = () => {
      for (const fn of this.disconnectCallbacks) fn();
    };
    const handleConnectError = (error: Error) => {
      const message = error?.message ?? String(error);
      console.warn('[graphSocket] connect_error', message);
    };
    socket.on('connect', handleConnect);
    this.socketCleanup.push(() => socket.off('connect', handleConnect));
    socket.on('disconnect', handleDisconnect);
    this.socketCleanup.push(() => socket.off('disconnect', handleDisconnect));
    socket.on('connect_error', handleConnectError);
    this.socketCleanup.push(() => socket.off('connect_error', handleConnectError));
    manager.on('reconnect', handleReconnect);
    this.managerCleanup.push(() => manager.off('reconnect', handleReconnect));
    // No-op connect listener; optional
    const handleNodeStatus: ServerToClientEvents['node_status'] = (payload) => {
      const set = this.listeners.get(payload.nodeId);
      if (set) for (const fn of set) fn(payload);
    };
    socket.on('node_status', handleNodeStatus);
    this.socketCleanup.push(() => socket.off('node_status', handleNodeStatus));

    const handleNodeState: ServerToClientEvents['node_state'] = (payload) => {
      const set = this.stateListeners.get(payload.nodeId);
      if (set) for (const fn of set) fn(payload);
    };
    socket.on('node_state', handleNodeState);
    this.socketCleanup.push(() => socket.off('node_state', handleNodeState));

    const handleNodeReminderCount: ServerToClientEvents['node_reminder_count'] = (payload) => {
      const set = this.reminderListeners.get(payload.nodeId);
      if (set) for (const fn of set) fn(payload);
    };
    socket.on('node_reminder_count', handleNodeReminderCount);
    this.socketCleanup.push(() => socket.off('node_reminder_count', handleNodeReminderCount));
    // Chat events
    const handleChatCreated: ServerToClientEvents['conversation_created'] = (payload) => {
      const chatPayload: ChatCreatedPayload = { chat: payload.conversation };
      for (const fn of this.chatCreatedListeners) fn(chatPayload);
    };
    socket.on('conversation_created', handleChatCreated);
    this.socketCleanup.push(() => socket.off('conversation_created', handleChatCreated));

    const handleChatUpdated: ServerToClientEvents['conversation_updated'] = (payload) => {
      const chatPayload: ChatUpdatedPayload = { chat: payload.conversation };
      for (const fn of this.chatUpdatedListeners) fn(chatPayload);
    };
    socket.on('conversation_updated', handleChatUpdated);
    this.socketCleanup.push(() => socket.off('conversation_updated', handleChatUpdated));

    const handleChatActivityChanged: ServerToClientEvents['conversation_activity_changed'] = (payload) => {
      const chatPayload: ChatActivityPayload = { chatId: payload.conversationId, activity: payload.activity };
      for (const fn of this.chatActivityListeners) fn(chatPayload);
    };
    socket.on('conversation_activity_changed', handleChatActivityChanged);
    this.socketCleanup.push(() => socket.off('conversation_activity_changed', handleChatActivityChanged));

    const handleChatRemindersCount: ServerToClientEvents['conversation_reminders_count'] = (payload) => {
      const chatPayload: ChatRemindersPayload = {
        chatId: payload.conversationId,
        remindersCount: payload.remindersCount,
      };
      for (const fn of this.chatRemindersListeners) fn(chatPayload);
    };
    socket.on('conversation_reminders_count', handleChatRemindersCount);
    this.socketCleanup.push(() => socket.off('conversation_reminders_count', handleChatRemindersCount));

    const handleChatMessageCreated: ServerToClientEvents['message_created'] = (payload) => {
      const chatPayload: ChatMessageCreatedPayload = { chatId: payload.conversationId, message: payload.message };
      for (const fn of this.chatMessageCreatedListeners) fn(chatPayload);
    };
    socket.on('message_created', handleChatMessageCreated);
    this.socketCleanup.push(() => socket.off('message_created', handleChatMessageCreated));

    const handleChatRunStatusChanged: ServerToClientEvents['run_status_changed'] = (payload) => {
      const run: ChatRunSummary = {
        id: payload.run.id,
        chatId: payload.run.conversationId ?? payload.conversationId,
        status: payload.run.status,
        createdAt: payload.run.createdAt,
        updatedAt: payload.run.updatedAt,
      };
      const chatPayload: ChatRunStatusChangedPayload = { chatId: payload.conversationId, run };
      for (const fn of this.chatRunStatusListeners) fn(chatPayload);
    };
    socket.on('run_status_changed', handleChatRunStatusChanged);
    this.socketCleanup.push(() => socket.off('run_status_changed', handleChatRunStatusChanged));

    return socket;
  }

  onNodeStatus(nodeId: string, cb: Listener) {
    let set = this.listeners.get(nodeId);
    if (!set) {
      set = new Set();
      this.listeners.set(nodeId, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) this.listeners.delete(nodeId);
    };
  }

  onNodeState(nodeId: string, cb: StateListener) {
    let set = this.stateListeners.get(nodeId);
    if (!set) {
      set = new Set();
      this.stateListeners.set(nodeId, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) this.stateListeners.delete(nodeId);
    };
  }

  onReminderCount(nodeId: string, cb: ReminderListener) {
    let set = this.reminderListeners.get(nodeId);
    if (!set) {
      set = new Set();
      this.reminderListeners.set(nodeId, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) this.reminderListeners.delete(nodeId);
    };
  }

  // Subscribe to rooms
  subscribe(rooms: string[]) {
    const sock = this.connect();
    if (socketsEnabled && !sock.connected) {
      sock.connect();
    }
    const toJoin: string[] = [];
    for (const room of rooms) {
      if (!room || this.subscribedRooms.has(room)) continue;
      this.subscribedRooms.add(room);
      toJoin.push(room);
    }
    this.emitSubscriptions(toJoin);
  }

  unsubscribe(rooms: string[]) {
    for (const room of rooms) {
      this.subscribedRooms.delete(room);
    }
  }

  dispose() {
    const socket = this.socket;
    if (socket) {
      for (const cleanup of this.socketCleanup) {
        cleanup();
      }
      for (const cleanup of this.managerCleanup) {
        cleanup();
      }
      this.socketCleanup = [];
      this.managerCleanup = [];
      socket.disconnect();
    }

    this.socket = null;
    this.subscribedRooms.clear();
    this.listeners.clear();
    this.stateListeners.clear();
    this.reminderListeners.clear();
    this.chatCreatedListeners.clear();
    this.chatUpdatedListeners.clear();
    this.chatActivityListeners.clear();
    this.chatRemindersListeners.clear();
    this.chatMessageCreatedListeners.clear();
    this.chatRunStatusListeners.clear();
    this.connectCallbacks.clear();
    this.reconnectCallbacks.clear();
    this.disconnectCallbacks.clear();
  }

  // Chat listeners
  onChatCreated(cb: (payload: ChatCreatedPayload) => void) {
    this.chatCreatedListeners.add(cb);
    return () => {
      this.chatCreatedListeners.delete(cb);
    };
  }
  onChatUpdated(cb: (payload: ChatUpdatedPayload) => void) {
    this.chatUpdatedListeners.add(cb);
    return () => {
      this.chatUpdatedListeners.delete(cb);
    };
  }
  onChatActivityChanged(cb: (payload: ChatActivityPayload) => void) {
    this.chatActivityListeners.add(cb);
    return () => {
      this.chatActivityListeners.delete(cb);
    };
  }
  onChatRemindersCount(cb: (payload: ChatRemindersPayload) => void) {
    this.chatRemindersListeners.add(cb);
    return () => {
      this.chatRemindersListeners.delete(cb);
    };
  }
  onChatMessageCreated(cb: (payload: ChatMessageCreatedPayload) => void) {
    this.chatMessageCreatedListeners.add(cb);
    return () => {
      this.chatMessageCreatedListeners.delete(cb);
    };
  }
  onChatRunStatusChanged(cb: (payload: ChatRunStatusChangedPayload) => void) {
    this.chatRunStatusListeners.add(cb);
    return () => {
      this.chatRunStatusListeners.delete(cb);
    };
  }

  onConnected(cb: () => void) {
    this.connectCallbacks.add(cb);
    return () => {
      this.connectCallbacks.delete(cb);
    };
  }

  onReconnected(cb: () => void) {
    this.reconnectCallbacks.add(cb);
    return () => {
      this.reconnectCallbacks.delete(cb);
    };
  }

  onDisconnected(cb: () => void) {
    this.disconnectCallbacks.add(cb);
    return () => {
      this.disconnectCallbacks.delete(cb);
    };
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const graphSocket = new GraphSocket();
