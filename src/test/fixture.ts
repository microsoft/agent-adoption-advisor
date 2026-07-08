import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { Content } from '../engine/model.js';

/** Load the authored content for tests (same source the build compiles). */
export function loadContent(): Content {
  return parse(
    readFileSync(resolve(__dirname, '../../content/content.yaml'), 'utf8'),
    { strict: true },
  ) as Content;
}
