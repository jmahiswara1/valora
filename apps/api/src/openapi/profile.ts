import { ref } from './helpers.js';
import type { Route } from './types.js';

export const profileInputs = {

};

export const profileOutputs = {

};

export const profileRoutes: Route[] = [
{ order: 87, method: 'put', path: '/me/profile-photo', auth: true, binary: true, binaryMime: ['image/webp'], output: ref('User') },
{ order: 88, method: 'delete', path: '/me/profile-photo', auth: true, output: ref('User') },
{ order: 89, method: 'post', path: '/me/profile-photo/migrate', auth: true, output: ref('User') },
{ order: 90, method: 'get', path: '/users/{id}/profile-photo', auth: true, binary: true, output: { type: 'string', format: 'binary' } }
];
