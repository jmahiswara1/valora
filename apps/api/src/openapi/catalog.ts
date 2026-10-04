import { categoryAdminSchema } from '@valora/contracts';
import { object, uuid, text, array, ref } from './helpers.js';
import type { Route } from './types.js';

export const catalogInputs = {
CategoryAdminInput: categoryAdminSchema
};

export const catalogOutputs = {
City: object({ id: uuid, code: text, name: text, provinceName: text }),
Category: object({ code: text, name: text, subcategories: array(object({ code: text, name: text })) })
};

export const catalogRoutes: Route[] = [
{ order: 93, method: 'get', path: '/cities', output: array(ref('City')) }
];
