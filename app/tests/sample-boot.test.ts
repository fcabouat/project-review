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

  /** Stubs fetch with one canned JSON answer and records the asked URLs. */
  const stubFetch = (body: unknown, ok = true): string[] => {
    const asked: string[] = []
    vi.stubGlobal('fetch', (url: URL | string) => {
      asked.push(String(url))
      return Promise.resolve({ ok, json: () => Promise.resolve(body) })
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
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: true, json: () => Promise.reject(new Error('not JSON')) }),
    )
    await expect(fetchSample('fr', BASE)).resolves.toBeUndefined()
  })

  it('resolves undefined when the network itself refuses', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    await expect(fetchSample('fr', BASE)).resolves.toBeUndefined()
  })
})
