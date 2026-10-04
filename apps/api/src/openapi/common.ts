import { versionReasonSchema, accessReasonSchema, versionActionSchema } from '@valora/contracts';
import { object, integer, uuid, text } from './helpers.js';
import type { Route } from './types.js';

export const commonInputs = {
VersionReasonInput: versionReasonSchema,
AccessReasonInput: accessReasonSchema,
VersionActionInput: versionActionSchema
};

export const commonOutputs = {
Count: object({ count: integer }),
ActionResult: object({ id: uuid, status: text }),
ApiError: object({ error: object({ code: text, message: text, requestId: uuid, details: {} }, ['code', 'message', 'requestId']) })
};

export const commonRoutes: Route[] = [

];
