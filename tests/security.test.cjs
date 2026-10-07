const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { gzipSync } = require('node:zlib');

function harness(replies = [], addresses = {}) {
  const calls = [];
  const request = (url, options, callback) => {
    calls.push({ url: String(url), options });
    const req = new EventEmitter();
    req.destroy = () => {};
    req.end = () => queueMicrotask(() => {
      const reply = replies.shift() || {};
      const res = new EventEmitter();
      res.statusCode = reply.status || 200;
      res.headers = reply.headers || {};
      callback(res);
      for (const chunk of reply.chunks || [Buffer.from('ok')]) res.emit('data', chunk);
      res.emit('end');
    });
    return req;
  };
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync('lib/safe-fetch.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, URL, Response, Headers, AbortSignal, Buffer, require: name => {
    if (name === 'node:dns/promises') return { lookup: async host => addresses[host] || [{ address: '93.184.216.34', family: 4 }] };
    if (name === 'node:http' || name === 'node:https') return { request };
    return require(name);
  } });
  return { ...module.exports, calls };
}

test('pins validated address while preserving HTTP Host and TLS SNI', async () => {
  const h = harness();
  assert.equal((await h.safeFetch('https://jobs.example.com/post')).ok, true);
  assert.equal(h.calls[0].options.hostname, '93.184.216.34');
  assert.equal(h.calls[0].options.servername, 'jobs.example.com');
  assert.equal(h.calls[0].options.headers.host, 'jobs.example.com');
});
test('rejects local, metadata, mapped IPv6 and unsupported protocols before connecting', async () => {
  const h = harness();
  for (const url of ['http://localhost', 'http://169.254.169.254', 'http://[::ffff:7f00:1]', 'http://[::1]', 'file:///etc/passwd', 'https://user:password@example.com']) {
    assert.equal((await h.safeFetch(url)).ok, false, url);
  }
  assert.equal(h.calls.length, 0);
});
test('rejects mixed public/private DNS answers', async () => {
  const h = harness([], { 'mixed.example': [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }] });
  assert.equal((await h.safeFetch('https://mixed.example')).reason, 'internal_url');
  assert.equal(h.calls.length, 0);
});
test('revalidates redirect destinations', async () => {
  const h = harness([{ status: 302, headers: { location: 'http://127.0.0.1/admin' } }]);
  assert.equal((await h.safeFetch('http://public.example')).reason, 'internal_url');
  assert.equal(h.calls.length, 1);
});
test('strips credentials on cross-origin redirects', async () => {
  const h = harness([{ status: 302, headers: { location: 'https://other.example' } }, {}]);
  assert.equal((await h.safeFetch('https://public.example', { init: { headers: { Authorization: 'secret', Cookie: 'secret', 'X-Figma-Token': 'secret' } } })).ok, true);
  for (const key of ['authorization', 'cookie', 'x-figma-token']) assert.equal(h.calls[1].options.headers[key], undefined);
});
test('bounds chunked and compressed response bytes', async () => {
  const h = harness([{ chunks: [Buffer.alloc(6), Buffer.alloc(6)] }, { headers: { 'content-encoding': 'gzip' }, chunks: [gzipSync(Buffer.alloc(5000))] }]);
  assert.equal((await h.safeFetch('https://public.example', { maxBytes: 10 })).reason, 'too_large');
  assert.equal((await h.safeFetch('https://public.example', { maxBytes: 100 })).reason, 'too_large');
});
test('blocks TLS downgrade and bounds redirect loops', async () => {
  const h = harness([{ status: 302, headers: { location: 'http://other.example' } }, { status: 302, headers: { location: '/again' } }]);
  assert.equal((await h.safeFetch('https://public.example')).reason, 'blocked_protocol');
  assert.equal((await h.safeFetch('https://public.example', { maxRedirects: 0 })).reason, 'too_many_redirects');
});
