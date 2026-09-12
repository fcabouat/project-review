/** Loopback-only static server shared by the built-product browser checks. */
import { createServer } from 'node:http'
import { readFile, realpath } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.json': 'application/json',
}

export async function serve(root) {
  const base = await realpath(root)
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent((request.url ?? '/').split('?')[0])
      if (!path.startsWith('/') || /[\\\0]/.test(path) || path.split('/').includes('..')) {
        throw new Error('Invalid static path')
      }
      // Seed storage on the app's origin without booting an editor and racing its save.
      if (path === '/__seed.html') {
        response.writeHead(200, { 'content-type': MIME['.html'] })
        response.end('<!doctype html><meta charset="utf-8"><title>seed</title>')
        return
      }
      const candidate = resolve(base, '.' + path)
      if (!candidate.startsWith(base + sep)) throw new Error('Outside static root')
      // Resolve symlinks too; a lexical prefix alone does not contain file reads.
      const file = await realpath(candidate)
      if (!file.startsWith(base + sep)) throw new Error('Outside static root')
      const body = await readFile(file)
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  return new Promise((ready, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => ready(server))
  })
}
