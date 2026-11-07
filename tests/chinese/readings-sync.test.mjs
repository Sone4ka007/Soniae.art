import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const index = readFileSync(join(root, 'chinese/index.html'), 'utf8');
const liveReadings = JSON.parse(readFileSync(join(root, 'chinese/data/readings.json'), 'utf8'));

function embeddedReadings(source) {
  const marker = '"readings.json":';
  const at = source.indexOf(marker);
  assert.ok(at >= 0, 'No embedded reading data in the site');
  assert.equal(source.indexOf(marker, at + marker.length), -1, 'Multiple embedded reading copies');
  let start = at + marker.length;
  while (/\s/.test(source[start])) start++;
  assert.equal(source[start], '{', 'Unexpected embedded readings format');
  let quote = false, escaped = false, depth = 0;
  for (let i=start; i<source.length; i++) {
    const c=source[i];
    if (quote) {
      if (escaped) escaped=false;
      else if (c === '\\') escaped=true;
      else if (c === '"') quote=false;
      continue;
    }
    if(c === '"') quote=true;
    else if(c === '{') depth++;
    else if(c === '}'){
      depth--;
      if(depth===0)return JSON.parse(source.slice(start,i+1));
    }
  }
  throw Error('Incomplete embedded readings JSON');
}

test('website embedded stories equal external published readings.json', () => {
  assert.deepEqual(embeddedReadings(index), liveReadings);
});
test('website checks live JSON before using embedded offline copy', () => {
  assert.match(index, /await fetch\(url,\{cache:"no-store"\}\)/);
  assert.match(index, /window\.chineseLabLessonFetch=async url=>/);
});
