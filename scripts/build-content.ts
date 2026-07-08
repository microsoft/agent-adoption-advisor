// Build step: compile the SME-authored YAML into the runtime JSON the browser
// loads. The browser never parses YAML — zero parser weight in the client.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = resolve(root, 'content/content.yaml');
const outPath = resolve(root, 'public/content.json');

const raw = readFileSync(srcPath, 'utf8');
// `strict: true` surfaces duplicate keys and other YAML mistakes as errors.
const data = parse(raw, { strict: true });

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`content:build wrote ${outPath}`);
