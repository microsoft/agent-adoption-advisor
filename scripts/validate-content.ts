// CI validation gate. Fails the build (exit 1) if the compiled content is
// invalid. Two layers:
//   1. JSON Schema (shape, required fields, types, non-empty strings).
//   2. Semantic cross-references the schema cannot express (dangling ids,
//      duplicate ids, orphan rules). A bad SME edit must break the build here,
//      not in front of a customer.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { validateContent } from '../src/content/validate.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(
  readFileSync(resolve(root, 'schema/content.schema.json'), 'utf8'),
);
const content = JSON.parse(
  readFileSync(resolve(root, 'public/content.json'), 'utf8'),
);

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const schemaOk = ajv.validate(schema, content);

const errors: string[] = [];
if (!schemaOk) {
  for (const e of ajv.errors ?? []) {
    errors.push(`schema ${e.instancePath || '/'} ${e.message ?? ''}`.trim());
  }
}
errors.push(...validateContent(content));

if (errors.length > 0) {
  console.error('content:validate FAILED');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('content:validate OK');
