import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lesson = JSON.parse(readFileSync(join(root, 'chinese/data/lesson1.json'), 'utf8'));
const fakeWindow = {};
runInNewContext(readFileSync(join(root, 'chinese/js/object-match.js'), 'utf8'), {window: fakeWindow});
runInNewContext(readFileSync(join(root, 'chinese/js/exercise-sessions.js'), 'utf8'), {window: fakeWindow});
const engine = fakeWindow.ChineseLabObjectMatch;
const sessions = fakeWindow.ChineseLabSessions;
const shuffle = list => [...list].reverse();
const deps = () => {
  const effects = {xp:0, mistakes:0, said:[]};
  return {effects, award(points) { effects.xp += points; }, miss() { effects.mistakes++; }, speech(zh) { effects.said.push(zh); }};
};

test('lesson 1 image targets use only taught words and real hotspots', () => {
  const targets = engine.objects(lesson);
  const words = new Set(lesson.words.map(w => w.hanzi));
  assert.equal(targets.length, 6);
  assert(targets.every(t => words.has(t.word)));
  assert.equal(new Set(targets.map(t => t.id)).size, targets.length);
});

test('select word, search image, hear Chinese and earn XP only on a match', () => {
  const game = engine.create(lesson, shuffle), ctx = deps();
  const right = game.order[0], wrong = game.order[1];
  assert(engine.valid(game, lesson));
  assert(engine.action('object-word', right, game, lesson, ctx));
  assert.equal(ctx.effects.said.length, 1);
  assert(engine.action('object-spot', wrong, game, lesson, ctx));
  assert.equal(ctx.effects.xp, 0);
  assert.equal(ctx.effects.mistakes, 1);
  assert.equal(game.matched.length, 0);
  assert(engine.action('object-spot', right, game, lesson, ctx));
  assert.equal(ctx.effects.xp, 10);
  assert.deepEqual(Array.from(game.matched), [right]);
  assert(engine.valid(game, lesson));
});

test('pinyin and Russian are hidden until requested', () => {
  const game = engine.create(lesson, shuffle), ctx = deps();
  const render = () => engine.render(lesson, game, {esc: String, sceneURL: image => image});
  assert(!render().includes('jiǎngxuéjīn'));
  assert(!render().includes('стипендия'));
  const id = game.order.find(id => lesson.scene.spots.find(x => x.id === id).word === '奖学金');
  engine.action('object-word', id, game, lesson, ctx);
  assert(!render().includes('jiǎngxuéjīn'));
  engine.action('object-hint', '', game, lesson, ctx);
  assert(render().includes('jiǎngxuéjīn'));
  assert(!render().includes('стипендия'));
  engine.action('object-hint', '', game, lesson, ctx);
  assert(render().includes('стипендия'));
  engine.action('object-hint', '', game, lesson, ctx);
  assert(render().includes('is-guided'));
});

test('the active round resumes from the original order and partial answers', () => {
  const game = engine.create(lesson, shuffle), ctx = deps();
  engine.action('object-word', game.order[0], game, lesson, ctx);
  engine.action('object-spot', game.order[0], game, lesson, ctx);
  const progress = {sessions:{}};
  assert(sessions.persist(progress, 1, 'objects', game, lesson));
  const restored = sessions.restore(progress, 1, 'objects', lesson);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(game)));
  assert(!engine.valid({...game, order:[game.order[0],game.order[0]]}, lesson));
  assert(sessions.clear(progress, 1, 'objects'));
});

test('the mode is present only for lesson 1 without touching other exercises', () => {
  const html = readFileSync(join(root, 'chinese/index.html'), 'utf8');
  assert(html.includes("modeInfo.filter(m => m.id !== 'objects' || l.id === 1)"));
  assert(html.includes("if (mode === 'objects' && state.lessonId !== 1) mode = 'pairs'"));
  assert(html.includes("case 'object-word':case 'object-spot':case 'object-hint':case 'object-zoom'"));
  assert(html.includes('./js/object-match.js?v=20261111-1'));
  assert(html.includes('./css/object-match.css?v=20261111-1'));
});
