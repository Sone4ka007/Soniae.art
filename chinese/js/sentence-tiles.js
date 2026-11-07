/* Chinese Lab: sentence data is curated as one Chinese word per tile.
 * Do not re-segment in the browser: general tokenizers may split proper nouns,
 * e.g. 酸汤米线, or merge distinct words such as 我 + 想.
 * Keep duplicates and exact punctuation for variant matching.
 */
(function (global) {
  'use strict';
  function split(parts) {
    return Array.isArray(parts) ? parts.map(part => String(part)) : [];
  }
  global.ChineseLabSentenceTiles = Object.freeze({ split });
})(window);
