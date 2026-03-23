export type DraftParticipant = {
  id: string;
  name: string;
  type: 'agent' | 'user';
};

export type ChatDraft = {
  id: string;
  participants: DraftParticipant[];
  inputValue: string;
  createdAt: string;
};
