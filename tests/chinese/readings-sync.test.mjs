import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const index = readFileSync(join(root, 'chinese/index.html'), 'utf8');
const offline = readFileSync(join(root, 'chinese/js/offline-bundle.js'), 'utf8');
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

test('website embedded fallback agrees with published chapters; newly published lessons may be external only', () => {
  const embedded=embeddedReadings(offline);
  for(const [id, chapters] of Object.entries(embedded)) {
    assert.deepEqual(chapters, liveReadings[id], `Offline reading for lesson ${id} differs from published data`);
  }
  const manifest=JSON.parse(readFileSync(join(root, 'chinese/data/manifest.json'), 'utf8'));
  for(const name of manifest.lessons){
    const id=name.match(/lesson(\d+)\.json/)?.[1];
    assert.ok(id && Array.isArray(liveReadings[id]) && liveReadings[id].length===3,`Published lesson ${name} must have three chapters`);
  }
});
test('website checks live JSON before using embedded offline copy', () => {
  assert.match(index, /<script src="\.\/js\/offline-bundle\.js"><\/script>/);
  assert.match(offline, /await fetch\(url,\{cache:"no-store"\}\)/);
  assert.match(offline, /window\.chineseLabLessonFetch=async url=>/);
});
