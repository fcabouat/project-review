import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { serve } from './server.mjs'

// Raw HTTP preserves traversal segments that URL clients may normalize away.
function request(server, path) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: server.address().port })
    let result = ''
    socket.setEncoding('utf8')
    socket.setTimeout(5000, () => socket.destroy(new Error('Static server timed out')))
    socket.on('error', reject)
    socket.on('data', (chunk) => (result += chunk))
    socket.on('end', () => {
      const [headers, body] = result.split('\r\n\r\n')
      resolve({ status: Number(headers.split(' ')[1]), headers, body })
    })
    socket.on('connect', () => {
      socket.write(`GET ${path} HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n`)
    })
  })
}

test('loopback static server confines reads and survives invalid requests', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'project-review-static-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const root = join(fixture, 'public')
  const sibling = join(fixture, 'public-private')
  await mkdir(root)
  await mkdir(sibling)
  await writeFile(join(root, 'index.html'), '<h1>Public</h1>')
  await writeFile(join(root, 'été.json'), '{"public":true}')
  await writeFile(join(sibling, 'private.txt'), 'PRIVATE FIXTURE')
  await symlink(join(sibling, 'private.txt'), join(root, 'escape.txt'))
  await symlink(sibling, join(root, 'escape-dir'))
  await symlink(join(root, 'index.html'), join(root, 'inside.html'))
  const server = await serve(root)
  t.after(() => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))))
  assert.equal(server.address().address, '127.0.0.1')

  await t.test('serves normal, encoded, internal-link and seed URLs', async () => {
    for (const path of ['/index.html?sample', '/inside.html']) {
      const response = await request(server, path)
      assert.equal(response.status, 200)
      assert.equal(response.body, '<h1>Public</h1>')
      assert.match(response.headers, /content-type: text\/html/i)
    }
    assert.equal((await request(server, '/%C3%A9t%C3%A9.json')).body, '{"public":true}')
    assert.equal((await request(server, '/__seed.html')).status, 200)
  })

  await t.test('rejects traversal, sibling prefixes and external symlinks', async () => {
    for (const path of [
      '/../public-private/private.txt',
      '/%2e%2e/public-private/private.txt',
      '/..%2fpublic-private%2fprivate.txt',
      '/%2e%2e%5cpublic-private%5cprivate.txt',
      '/%252e%252e/public-private/private.txt',
      '/escape.txt',
      '/escape-dir/private.txt',
    ]) {
      const response = await request(server, path)
      assert.equal(response.status, 404, path)
      assert.ok(!response.body.includes('PRIVATE FIXTURE'), path)
    }
  })

  await t.test('rejects malformed, missing and directory paths without crashing', async () => {
    for (const path of ['/%ZZ', '/%C0%AF', '/%00', '/missing', '/']) {
      assert.equal((await request(server, path)).status, 404, path)
    }
    assert.equal((await request(server, '/index.html')).status, 200)
  })
})
