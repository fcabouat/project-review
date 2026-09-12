/**
 * Pins the `?sample` boot policy (`src/sample-boot.ts`): when the demo link
 * may fill the app, and what it fills it with — the neighbour file over http,
 * through the strict parse, silently refused everywhere else. The DOM reads
 * (URL, stored document, `document.baseURI`) live with the callers; this file
 * exercises the whole decision with an injected base and a stubbed fetch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import sampleFr from '@project-review/core/samples/sample-portfolio.fr.json'
import sampleEn from '@project-review/core/samples/sample-portfolio.en.json'
import { MAX_IMPORT_BYTES } from '@project-review/core/model/budget'
import { detectLanguage, fetchSample, sampleFileName, shouldBootSample } from '../src/sample-boot'

describe('shouldBootSample — the demo never overwrites an existing base', () => {
  it('boots the sample when the URL asks and nothing is stored', () => {
    expect(shouldBootSample('?sample', null)).toBe(true)
  })

  it('tolerates a value on the parameter and other parameters around it', () => {
    expect(shouldBootSample('?sample=1', null)).toBe(true)
    expect(shouldBootSample('?foo=bar&sample', null)).toBe(true)
  })

  it('refuses when a document is stored, readable or not', () => {
    // If this breaks, following a `?sample` link would let the persistence
    // effect save the demo set over a real portfolio — the one loss the
    // feature must never cause. Bytes nobody could read count as an existing
    // base too: they are not free real estate until a person says so.
    expect(shouldBootSample('?sample', '1.420.9xk3p')).toBe(false)
    expect(shouldBootSample('?sample', '42.9001.1a2b3c')).toBe(false)
    expect(shouldBootSample('?sample', 'unreadable')).toBe(false)
  })

  it('refuses when the URL does not ask', () => {
    expect(shouldBootSample('', null)).toBe(false)
    expect(shouldBootSample('?print', null)).toBe(false)
  })
})

describe('detectLanguage — the first-boot pick', () => {
  it('honors explicit site languages, but rejects unsupported URL values', () => {
    expect(detectLanguage('en-US', '?sample&lang=fr')).toBe('fr')
    expect(detectLanguage('fr-FR', '?sample&lang=en')).toBe('en')
    expect(detectLanguage('fr-FR', '?lang=de')).toBe('fr')
  })
  it('reads any fr-* locale as French, everything else as English', () => {
    expect(detectLanguage('fr')).toBe('fr')
    expect(detectLanguage('fr-FR')).toBe('fr')
    expect(detectLanguage('FR-ca')).toBe('fr')
    expect(detectLanguage('en-US')).toBe('en')
    expect(detectLanguage('de')).toBe('en')
    expect(detectLanguage('')).toBe('en')
  })
})

describe('fetchSample — the neighbour file, strictly parsed, silently refused', () => {
  const BASE = 'http://127.0.0.1:8080/dist/project-review.html'

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** A response whose body streams `text` in small chunks — the shape the
   * bounded read actually consumes, so the tests exercise the real path. */
  const streamed = (text: string, headers: Record<string, string> = {}): unknown => {
    const bytes = new TextEncoder().encode(text)
    let offset = 0
    return {
      ok: true,
      headers: { get: (name: string) => headers[name] ?? null },
      body: {
        getReader: () => ({
          read: () => {
            if (offset >= bytes.length) return Promise.resolve({ done: true, value: undefined })
            const slice = bytes.slice(offset, offset + 64)
            offset += slice.length
            return Promise.resolve({ done: false, value: slice })
          },
          cancel: () => Promise.resolve(),
        }),
      },
    }
  }

  /** Stubs fetch with one canned JSON answer and records the asked URLs. */
  const stubFetch = (body: unknown, ok = true): string[] => {
    const asked: string[] = []
    vi.stubGlobal('fetch', (url: URL | string) => {
      asked.push(String(url))
      const response = streamed(JSON.stringify(body)) as { ok: boolean }
      return Promise.resolve({ ...response, ok })
    })
    return asked
  }

  it('names the per-language neighbour file', () => {
    expect(sampleFileName('fr')).toBe('sample-portfolio.fr.json')
    expect(sampleFileName('en')).toBe('sample-portfolio.en.json')
  })

  it('yields the French set, 20 projects, fetched NEXT TO the document', async () => {
    const asked = stubFetch(sampleFr)
    const portfolio = await fetchSample('fr', BASE)
    expect(asked).toEqual(['http://127.0.0.1:8080/dist/sample-portfolio.fr.json'])
    expect(portfolio?.projects).toHaveLength(20)
    expect(portfolio?.settings.language).toBe('fr')
  })

  it('yields the English set, 20 projects in its own language', async () => {
    stubFetch(sampleEn)
    const portfolio = await fetchSample('en', BASE)
    expect(portfolio?.projects).toHaveLength(20)
    expect(portfolio?.settings.language).toBe('en')
  })

  it('refuses a sample served under the wrong language name', async () => {
    stubFetch(sampleFr)
    await expect(fetchSample('en', BASE)).resolves.toBeUndefined()
  })

  it('never even fetches from file:// — the console must stay clean', async () => {
    const asked = stubFetch(sampleFr)
    await expect(fetchSample('fr', 'file:///C:/deck/project-review.html')).resolves.toBeUndefined()
    await expect(fetchSample('fr', '')).resolves.toBeUndefined()
    expect(asked).toEqual([])
  })

  it('resolves undefined on a missing file (http error), silently', async () => {
    stubFetch({}, false)
    await expect(fetchSample('fr', BASE)).resolves.toBeUndefined()
  })

  it('resolves undefined on a contract violation — same strict parse as any import', async () => {
    stubFetch({ version: 3, unexpected: true })
    await expect(fetchSample('fr', BASE)).resolves.toBeUndefined()
  })

  it('resolves undefined when the response is not JSON at all', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(streamed('not JSON at all')))
    await expect(fetchSample('fr', BASE)).resolves.toBeUndefined()
  })

  /* AMPLIFICATION — a served file must never be allocated before it is
     judged. The two bounds below are the whole of the guard: the length the
     server DECLARES, and the length it actually sends. */
  it('refuses on the declared length, without reading one byte', async () => {
    let readBody = false
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        headers: { get: () => String(MAX_IMPORT_BYTES + 1) },
        get body() {
          readBody = true
          return null
        },
      }),
    )
    await expect(fetchSample('fr', BASE)).resolves.toBeUndefined()
    expect(readBody).toBe(false)
  })

  it('abandons a body that keeps coming past the bound', async () => {
    let cancelled = false
    let served = 0
    const chunk = new TextEncoder().encode('x'.repeat(1_000_000))
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        // No declared length: the running count is the only guard left.
        headers: { get: () => null },
        body: {
          getReader: () => ({
            read: () => {
              served += 1
              return Promise.resolve({ done: false, value: chunk })
            },
            cancel: () => {
              cancelled = true
              return Promise.resolve()
            },
          }),
        },
      }),
    )
    await expect(fetchSample('fr', BASE)).resolves.toBeUndefined()
    expect(cancelled).toBe(true)
    // Bounded, and bounded TIGHTLY: the ceiling in megabytes, not the endless
    // stream the old `response.json()` would have swallowed whole.
    expect(served).toBeLessThanOrEqual(MAX_IMPORT_BYTES / chunk.byteLength + 1)
  })

  it('falls back to the whole read when the runtime streams nothing', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        headers: { get: () => null },
        body: null,
        text: () => Promise.resolve(JSON.stringify(sampleEn)),
      }),
    )
    const portfolio = await fetchSample('en', BASE)
    expect(portfolio?.projects).toHaveLength(20)
  })

  it('resolves undefined when the network itself refuses', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    await expect(fetchSample('fr', BASE)).resolves.toBeUndefined()
  })
})
