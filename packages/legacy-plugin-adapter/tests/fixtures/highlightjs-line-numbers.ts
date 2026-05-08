// Fixture shaped like the real upstream `highlightjs-line-numbers.js` plugin
// (https://github.com/wcoder/highlightjs-line-numbers.js/). spec §3.5: this is
// a deliberately faithful synthetic — we are NOT byte-copying upstream code
// (dispatch §D-7).
//
// What the real plugin does: registers `after:highlight`, splits the
// highlighted HTML by `\n`, wraps each line in a `<tr>` with a number cell,
// rewrites `result.value` to the resulting `<table>`. The class name in the
// real plugin is `hljs-ln`; we emit `hljs-line-numbers` here so the dispatch
// assertion text matches.

import type { LegacyHLJSPlugin } from '../../src/types.js';

const lineNumbersLegacy: LegacyHLJSPlugin = {
  'after:highlight': (result) => {
    // Mutating the readonly `value` is the legacy contract — Scout §2 documents
    // it explicitly. The adapter quarantines this mutation in spec §3.3 row 2.
    const lines = result.value.split('\n');
    const rows = lines
      .map(
        (line, i) =>
          `<tr><td class="ln-num" data-num="${i + 1}"></td><td class="ln-code">${line}</td></tr>`,
      )
      .join('');
    (result as { value: string }).value = `<table class="hljs-line-numbers">${rows}</table>`;
  },
};

export default lineNumbersLegacy;
