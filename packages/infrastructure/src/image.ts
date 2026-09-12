/**
 * The picked-image adapter: one file chosen in the Settings card, read into
 * the `data:image/…` URI the portfolio carries as its logo.
 *
 * SAME SEAM AS THE FONT READER (`readWoff2File`, in `fonts.ts`): FileReader is
 * a browser affair, so it lives on this side and the pure screens receive it
 * as a prop. The card maps, checks its cap and dispatches; it opens no file
 * itself.
 *
 * The two rules stay where they already were: the SHAPE is the core's own
 * (`values/logo.ts`), so what this lets in is exactly what the strict parse
 * lets back in, and the SIZE is the card's, which is where the refusal is
 * worded.
 */
import { isImageDataUri } from '@project-review/core/values/logo'

/* v8 ignore start -- FileReader half: the same out-of-node perimeter as
   fonts.ts's own reader, and the shape rule it applies is unit-tested in the
   core (values/logo). */
/**
 * Reads one picked file into the portfolio's inline-logo shape. TOTAL: an
 * unreadable file, or one the browser does not name as an image, resolves
 * `null` and never throws — the Settings card turns `null` into its calm
 * refusal line.
 */
export function readImageFile(file: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve(null)
    reader.onload = () =>
      resolve(
        typeof reader.result === 'string' && isImageDataUri(reader.result) ? reader.result : null,
      )
    reader.readAsDataURL(file)
  })
}
/* v8 ignore stop */
