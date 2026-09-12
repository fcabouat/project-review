/**
 * What a binary asset costs once it travels as a `data:` URI — the arithmetic
 * the two asset guards share (values/font.ts, values/logo.ts).
 *
 * The guards themselves count CHARACTERS: that is what the file format carries,
 * and the domain decodes no bytes (values stay binary-free). But a file picker
 * knows a file by its DECLARED SIZE alone, and reading a file in full to
 * discover it was always too large is precisely the read the guard exists to
 * avoid — base64 spends four characters for every three bytes, so a file past
 * {@link maxDeclaredBytes} of a ceiling cannot encode under it whatever it
 * contains, and refusing it unread refuses nothing admissible.
 *
 * PURE module: no import at all.
 */

/**
 * Largest declared file size, in bytes, that could still encode within
 * `maxChars` characters. Exact rather than prudent: base64 writes
 * `ceil(bytes / 3) * 4` characters, so anything above this bound already
 * exceeds the ceiling on its payload alone — before the `data:…;base64,`
 * prefix the URI adds on top. Pinned by tests/values/data-uri.test.ts.
 */
export const maxDeclaredBytes = (maxChars: number): number => Math.floor((maxChars * 3) / 4)
