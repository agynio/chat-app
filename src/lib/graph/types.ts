export type ProvisionState =
  | 'not_ready'
  | 'provisioning'
  | 'ready'
  | 'error'
  | 'deprovisioning'
  | 'provisioning_error'
  | 'deprovisioning_error';

export interface ProvisionStatus {
  state: ProvisionState;
  details?: unknown;
}

export interface NodeStatus {
  isPaused?: boolean;
  provisionStatus?: ProvisionStatus;
  // dynamicConfigReady removed
}

export interface NodeStatusEvent extends NodeStatus {
  nodeId: string;
  updatedAt?: string;
}

// Shared DTO for reminders
export interface ReminderCountEvent {
  nodeId: string;
  count: number;
  updatedAt: string; // ISO timestamp
}
