import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppRequest } from './http.js';
export const requestContext = new AsyncLocalStorage<{ actor?: AppRequest['actor']; accessExpiresAt?: string }>();
