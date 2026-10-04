'use client';

import { useState } from 'react';

/* eslint-disable @next/next/no-img-element */
export function ProfileAvatar({ photoUrl, displayName, className = '' }: { photoUrl: string | null; displayName: string; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = photoUrl !== null && failedSource === photoUrl;
  const initial = displayName.trim().slice(0, 1).toLocaleUpperCase('id-ID') || '?';
  return <span className={`profile-avatar ${className}`} aria-hidden="true">{photoUrl && !failed ? <img src={photoUrl} alt="" onError={() => setFailedSource(photoUrl)} /> : <span>{initial}</span>}</span>;
}
