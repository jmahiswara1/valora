'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type SetStateAction } from 'react';

export type DraftPhoto = { id: string; file: File; preview: string; state: 'uploading' | 'ready' | 'error'; ticketId?: string; error?: string };
type Intent = { clientMessageId: string; body: string; ticketIds: string[] };
type Draft = { body: string; photos: DraftPhoto[]; error: string; busy: boolean; uncertain: boolean };
function entry() {
  return { value: { body: '', photos: [], error: '', busy: false, uncertain: false } as Draft, intent: { current: null as Intent | null }, running: { current: false }, active: { current: true }, listeners: new Set<() => void>() };
}
type Entry = ReturnType<typeof entry>;
const Context = createContext<Map<string, Entry> | null>(null);

export function ChatDraftProvider({ children }: { children: ReactNode }) {
  const [drafts] = useState(() => new Map<string, Entry>());
  useEffect(() => {
    for (const draft of drafts.values()) draft.active.current = true;
    return () => {
      for (const draft of drafts.values()) {
        draft.active.current = false;
        for (const photo of draft.value.photos) URL.revokeObjectURL(photo.preview);
      }
    };
  }, [drafts]);
  return <Context.Provider value={drafts}>{children}</Context.Provider>;
}

export function useChatDraft(id: string) {
  const drafts = useContext(Context);
  if (!drafts) throw new Error('ChatDraftProvider missing');
  let draft = drafts.get(id);
  if (!draft) { draft = entry(); drafts.set(id, draft); }
  const current = draft;
  const value = useSyncExternalStore(listener => { current.listeners.add(listener); return () => { current.listeners.delete(listener); }; }, () => current.value, () => current.value);
  function setter<K extends keyof Draft>(key: K) {
    return (action: SetStateAction<Draft[K]>) => {
      if (!current.active.current) return;
      const next = typeof action === 'function' ? (action as (previous: Draft[K]) => Draft[K])(current.value[key]) : action;
      current.value = { ...current.value, [key]: next };
      for (const listener of current.listeners) listener();
    };
  }
  return { ...value, intent: current.intent, running: current.running, active: current.active, setBody: setter('body'), setPhotos: setter('photos'), setError: setter('error'), setBusy: setter('busy'), setUncertain: setter('uncertain') };
}
