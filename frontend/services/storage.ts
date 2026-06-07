import { Message, Conversation } from '../types';

const MEMORY_KEY = 'devina2_memory';
const HISTORY_KEY = 'devina2_history';
const ARCHIVE_KEY = 'devina2_archive';
const CONVS_KEY = 'devina2_conversations';
const THREE_MONTHS = 90 * 24 * 60 * 60 * 1000;

export const loadMemory = (): string[] => {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]'); } catch { return []; }
};

export const saveMemory = (facts: string[]) => {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(facts));
};

export const loadHistory = (): Message[] => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
};

export const saveHistory = (history: Message[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-40)));
};

export const loadArchive = (): Message[] => {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
};

export const saveArchive = (archive: Message[]) => {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
};

export const loadConvs = (): Conversation[] => {
  try { return JSON.parse(localStorage.getItem(CONVS_KEY) || '[]'); } catch { return []; }
};

export const saveConvs = (convs: Conversation[]) => {
  localStorage.setItem(CONVS_KEY, JSON.stringify(convs));
};

export const runAutoArchive = (): Message[] => {
  const now = Date.now();
  const active = loadHistory();
  const archive = loadArchive();
  const stillActive: Message[] = [];
  const toArchive: Message[] = [];

  active.forEach(msg => {
    if (msg.ts && (now - msg.ts) > THREE_MONTHS) toArchive.push(msg);
    else stillActive.push(msg);
  });

  if (toArchive.length > 0) {
    const merged = [...archive, ...toArchive].slice(-500);
    saveArchive(merged);
    saveHistory(stillActive);
    return stillActive;
  }
  return active;
};

export const clearAllData = () => {
  localStorage.removeItem(MEMORY_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(ARCHIVE_KEY);
  localStorage.removeItem(CONVS_KEY);
};