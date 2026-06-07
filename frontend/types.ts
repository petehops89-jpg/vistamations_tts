export interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

export interface Conversation {
  id: number;
  date: string;
  preview: string;
  count: number;
  messages: Message[];
}

export interface ExportData {
  exported: string;
  facts: string[];
  history: Message[];
  archive: Message[];
  conversations: Conversation[];
}