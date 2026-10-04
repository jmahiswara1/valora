import { z } from 'zod';
import type { SchemaObject } from '@nestjs/swagger';

export const ref = (name: string): SchemaObject => ({ $ref: `#/components/schemas/${name}` }) as unknown as SchemaObject;

export const text: SchemaObject = { type: 'string' };

export const date: SchemaObject = { type: 'string', format: 'date-time' };

export const uuid: SchemaObject = { type: 'string', format: 'uuid' };

export const nullable = (schema: SchemaObject): SchemaObject => ({ oneOf: [schema, { type: 'null' }] });

export const object = (properties: Record<string, SchemaObject>, required = Object.keys(properties)): SchemaObject => ({ type: 'object', properties, required });

export const envelope = (schema: SchemaObject): SchemaObject => object({ data: schema, meta: object({ nextCursor: nullable(text), overdue: array(ref('OverdueTransaction')) }, ['nextCursor']) }, ['data']);

export const array = (schema: SchemaObject): SchemaObject => ({ type: 'array', items: schema });

export const integer: SchemaObject = { type: 'integer' };

export function inputSchema(schema: z.ZodType): SchemaObject {
  const result = z.toJSONSchema(schema) as SchemaObject & { $schema?: string };
  delete result.$schema;
  return result;
}

export const ticket = object({ ticketId: uuid, uploadUrl: text, expiresAt: date });

export const str = text;
export const num = integer;
export const bool: SchemaObject = { type: 'boolean' };
export const obj = object;
export const arr = array;
export const nil = nullable;
export const result = object({ id: uuid, version: integer }, []);
