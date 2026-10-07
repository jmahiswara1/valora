import { inputSchema, ref, envelope } from './helpers.js';
import type { OpenAPIObject, OperationObject } from '@nestjs/swagger';
import { authInputs, authOutputs, authRoutes } from './auth.js';
import { offersInputs, offersOutputs, offersRoutes } from './offers.js';
import { transactionsInputs, transactionsOutputs, transactionsRoutes } from './transactions.js';
import { disputesInputs, disputesOutputs, disputesRoutes } from './disputes.js';
import { commonInputs, commonOutputs, commonRoutes } from './common.js';
import { operationsInputs, operationsOutputs, operationsRoutes } from './operations.js';
import { historyInputs, historyOutputs, historyRoutes } from './history.js';
import { retentionInputs, retentionOutputs, retentionRoutes } from './retention.js';
import { assessmentsInputs, assessmentsOutputs, assessmentsRoutes } from './assessments.js';
import { catalogInputs, catalogOutputs, catalogRoutes } from './catalog.js';
import { adminInputs, adminOutputs, adminRoutes } from './admin.js';
import { itemsInputs, itemsOutputs, itemsRoutes } from './items.js';
import { mediaInputs, mediaOutputs, mediaRoutes } from './media.js';
import { repairsInputs, repairsOutputs, repairsRoutes } from './repairs.js';
import { listingsInputs, listingsOutputs, listingsRoutes } from './listings.js';
import { conversationsInputs, conversationsOutputs, conversationsRoutes } from './conversations.js';
import { profileInputs, profileOutputs, profileRoutes } from './profile.js';
import { notificationsInputs, notificationsOutputs, notificationsRoutes } from './notifications.js';
import { favoritesInputs, favoritesOutputs, favoritesRoutes } from './favorites.js';


const inputs = { ...authInputs, ...offersInputs, ...transactionsInputs, ...disputesInputs, ...commonInputs, ...operationsInputs, ...historyInputs, ...retentionInputs, ...assessmentsInputs, ...catalogInputs, ...adminInputs, ...itemsInputs, ...mediaInputs, ...repairsInputs, ...listingsInputs, ...conversationsInputs, ...profileInputs, ...favoritesInputs, ...notificationsInputs };
const outputSchemas = { ...authOutputs, ...offersOutputs, ...transactionsOutputs, ...disputesOutputs, ...commonOutputs, ...operationsOutputs, ...historyOutputs, ...retentionOutputs, ...assessmentsOutputs, ...catalogOutputs, ...adminOutputs, ...itemsOutputs, ...mediaOutputs, ...repairsOutputs, ...listingsOutputs, ...conversationsOutputs, ...profileOutputs, ...favoritesOutputs, ...notificationsOutputs };
const routes = [...authRoutes, ...offersRoutes, ...transactionsRoutes, ...disputesRoutes, ...commonRoutes, ...operationsRoutes, ...historyRoutes, ...retentionRoutes, ...assessmentsRoutes, ...catalogRoutes, ...adminRoutes, ...itemsRoutes, ...mediaRoutes, ...repairsRoutes, ...listingsRoutes, ...conversationsRoutes, ...profileRoutes, ...favoritesRoutes, ...notificationsRoutes].sort((a,b) => a.order - b.order);

export function completeOpenApi(document: OpenAPIObject): OpenAPIObject {
  document.openapi = '3.1.0';
  document.components ??= {};
  document.components.schemas = { ...(document.components.schemas ?? {}), ...Object.fromEntries(Object.entries(inputs).map(([key, schema]) => [key, inputSchema(schema)])), ...outputSchemas };
  document.components.securitySchemes = {
    sessionCookie: { type: 'apiKey', in: 'cookie', name: 'valora_session', description: 'Cookie sesi HttpOnly dari login.' },
    csrfCookie: { type: 'apiKey', in: 'cookie', name: 'valora_csrf', description: 'Cookie dari GET /auth/csrf.' },
    csrfHeader: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token', description: 'Nilai yang sama dengan token dari GET /auth/csrf.' },
  };
  for (const route of routes) {
    const path = document.paths['/api/v1' + route.path];
    const operation = path?.[route.method] as OperationObject | undefined;
    if (!operation) throw new Error(`OpenAPI route missing: ${route.method.toUpperCase()} ${route.path}`);
    if (route.input) operation.requestBody = { required: true, content: { 'application/json': { schema: ref(route.input) } } };
    if (route.idempotent) operation.parameters = [...(operation.parameters ?? []), { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', format: 'uuid' } }];
    if (route.query) operation.parameters = [...(operation.parameters ?? []), ...route.query.map((name) => ({ name, in: 'query' as const, required: false, schema: { type: 'string' as const } }))];
    if (route.binary && route.method === 'put') operation.requestBody = { required: true, content: Object.fromEntries((route.binaryMime ?? ['image/jpeg', 'image/png', 'image/webp']).map((mime) => [mime, { schema: { type: 'string', format: 'binary' } }])) };
    const success = route.method === 'post' ? '201' : '200';
    operation.responses = { [success]: { description: 'Berhasil', content: { [route.binary && route.method === 'get' ? 'image/webp' : 'application/json']: { schema: route.binary && route.method === 'get' ? route.output : envelope(route.output) } } }, default: { description: 'Error terstruktur', content: { 'application/json': { schema: ref('ApiError') } } } };
    operation.security = route.method === 'get' ? (route.auth ? [{ sessionCookie: [] }] : []) : [{ ...(route.auth ? { sessionCookie: [] } : {}), csrfCookie: [], csrfHeader: [] }];
  }
  return document;
}
