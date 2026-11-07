/* Chinese Lab: split oversized sentence-builder blocks into short word tiles.
 * Segmentation never changes character order or removes punctuation.
 * The exercise still grades against every original accepted sentence variant.
 */
(function (global) {
  'use strict';
  const HANZI_ONLY = /^[\u3400-\u9fff]+$/u;
  const DICTIONARY_WORD = /^[\u3400-\u9fff]{2,3}$/u;
  const SPLIT_RUNS = /[\u3400-\u9fff]+|[^\u3400-\u9fff]+/gu;

  function split(parts, vocabulary) {
    const known = new Set([...vocabulary.keys()].filter(word => DICTIONARY_WORD.test(word)));
    const segmenter = typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('zh-Hans', { granularity: 'word' })
      : null;
    const result = [];
    let leading = '';

    for (const part of parts) {
      for (const run of String(part).match(SPLIT_RUNS) || []) {
        if (!HANZI_ONLY.test(run)) {
          // Keep commas, periods and question marks attached to a word,
          // not as a trivial tile that can be placed independently.
          if (result.length) result[result.length - 1] += run;
          else leading += run;
          continue;
        }
        for (let at = 0; at < run.length;) {
          let found = '';
          for (const length of [3, 2]) {
            const candidate = run.slice(at, at + length);
            if (known.has(candidate)) {
              found = candidate;
              break;
            }
          }
          if (!found && segmenter) {
            const first = segmenter.segment(run.slice(at))[Symbol.iterator]().next().value;
            if (first && DICTIONARY_WORD.test(first.segment)) found = first.segment;
          }
          const tile = found || run[at];
          result.push(leading + tile);
          leading = '';
          at += tile.length;
        }
      }
    }

    if (leading) {
      if (result.length) result[result.length - 1] += leading;
      else result.push(leading);
    }
    return result;
  }

  global.ChineseLabSentenceTiles = Object.freeze({ split });
})(window);
