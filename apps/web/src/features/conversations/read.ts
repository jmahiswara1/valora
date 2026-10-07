'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useVisibleMessages(id: string, root: RefObject<HTMLElement | null>, messageKey: string, readSequence: number) {
  const cache = useQueryClient();
  const acknowledged = useRef({ id, sequence: readSequence || 0 });
  useEffect(() => { acknowledged.current = { id, sequence: acknowledged.current.id === id ? Math.max(acknowledged.current.sequence, readSequence || 0) : readSequence || 0 }; }, [id, readSequence]);
  useEffect(() => {
    if (!root.current) return;
    const visible = new Map<Element, number>();
    let timer: ReturnType<typeof setTimeout> | undefined, sending = false, active = true;
    const read = async () => {
      if (!active || sending || document.visibilityState !== 'visible' || !visible.size || document.querySelector('dialog[open]')) return;
      const actuallyVisible = [...visible].filter(([element]) => { const rect = element.getBoundingClientRect(); return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth; });
      if (!actuallyVisible.length) return;
      const throughSequence = Math.max(...actuallyVisible.map(([, sequence]) => sequence));
      if (throughSequence <= acknowledged.current.sequence) return;
      sending = true;
      try {
        const result = await api<{ readSequence: number }>(`/conversations/${id}/read`, { method: 'POST', body: { throughSequence } });
        if (!active) return;
        acknowledged.current.sequence = Math.max(acknowledged.current.sequence, result.readSequence);
        for (const key of [['conversations'], ['conversation', id], ['notification-center'], ['conversation-unread']]) void cache.invalidateQueries({ queryKey: key });
      } catch { /* A later visible update retries this monotonic cursor. */ }
      finally { sending = false; }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { void read(); }, 200); };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const sequence = Number((entry.target as HTMLElement).dataset.sequence);
        if (entry.isIntersecting && entry.intersectionRect.height >= Math.min(70, entry.boundingClientRect.height / 2) && Number.isSafeInteger(sequence) && sequence > 0) visible.set(entry.target, sequence);
        else visible.delete(entry.target);
      }
      schedule();
    }, { root: root.current, threshold: [0, .2, .5, 1] });
    root.current.querySelectorAll('[data-sequence]').forEach(element => observer.observe(element));
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const fallback = setInterval(schedule, 5000);
    return () => { active = false; clearTimeout(timer); clearInterval(fallback); observer.disconnect(); document.removeEventListener('visibilitychange', schedule); window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); };
  }, [id, root, messageKey, cache]);
}
