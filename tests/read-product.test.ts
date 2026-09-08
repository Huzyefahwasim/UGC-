import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import type {
  ClientRequest,
  IncomingMessage,
  IncomingHttpHeaders,
} from 'node:http';
import type { RequestOptions } from 'node:https';
import {
  createProductReader,
  validateResolvedAddresses,
  type ResolvedAddress,
} from '../lib/read-product.ts';

type Transport = NonNullable<
  NonNullable<Parameters<typeof createProductReader>[0]>['request']
>;
const publicAddresses: ResolvedAddress[] = [
  { address: '93.184.215.14', family: 4 },
  { address: '2606:4700:4700::1111', family: 6 },
];
const html =
  '<title>Bloom</title><meta name="description" content="A plant-care app">';

function fakeTransport(
  pages: {
    status?: number;
    headers?: IncomingHttpHeaders;
    chunks?: Buffer[];
    hang?: boolean;
  }[],
  inspect?: (url: URL, options: RequestOptions) => void,
) {
  const requests: PassThrough[] = [];
  const responses: PassThrough[] = [];
  const deliveredChunks: number[] = [];
  const request: Transport = (url, options, callback) => {
    const index = requests.length;
    const outgoing = new PassThrough();
    requests.push(outgoing);
    outgoing.once('finish', () => {
      queueMicrotask(() => {
        try {
          inspect?.(url, options);
        } catch (error) {
          outgoing.emit('error', error);
          return;
        }
        const page = pages[index] || pages.at(-1)!;
        const incoming = Object.assign(new PassThrough(), {
          statusCode: page.status ?? 200,
          headers: page.headers ?? {
            'content-type': 'text/html; charset=utf-8',
          },
        });
        responses.push(incoming);
        deliveredChunks[index] = 0;
        callback(incoming as unknown as IncomingMessage);
        if (!page.hang && !incoming.destroyed) {
          for (const chunk of page.chunks || [Buffer.from(html)]) {
            if (incoming.destroyed) break;
            deliveredChunks[index]++;
            incoming.write(chunk);
          }
          if (!incoming.destroyed) incoming.end();
        }
      });
    });
    return outgoing as unknown as ClientRequest;
  };
  return { request, requests, responses, deliveredChunks };
}

void test('the destination guard rejects private, reserved, mapped and malformed IP addresses', () => {
  for (const address of [
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.0.2.1',
    '192.168.0.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '255.255.255.255',
    '127.1',
    '999.1.1.1',
  ])
    assert.throws(
      () => validateResolvedAddresses([{ address, family: 4 }]),
      /public product website/,
      address,
    );
  for (const address of [
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '64:ff9b::a00:1',
    'fd00::1',
    'fe80::1',
    'ff02::1',
    '2001::1',
    '2001:db8::1',
    '2002:7f00:1::1',
    '3fff::1',
  ])
    assert.throws(
      () => validateResolvedAddresses([{ address, family: 6 }]),
      /public product website/,
      address,
    );
  assert.throws(() => validateResolvedAddresses([]), /public product website/);
  assert.throws(
    () => validateResolvedAddresses([{ address: '127.0.0.1', family: 6 }]),
    /public product website/,
  );
  assert.deepEqual(validateResolvedAddresses(publicAddresses), publicAddresses);
});

void test('one private AAAA answer blocks a hostname even when its A answer is public', async () => {
  let connected = false;
  const read = createProductReader({
    resolve: async () => [
      publicAddresses[0],
      { address: 'fd00::1', family: 6 },
    ],
    request: () => {
      connected = true;
      throw new Error('Must not open a socket');
    },
  });
  await assert.rejects(read('https://bloom.app'), /public product website/);
  assert.equal(connected, false);
});

void test('the socket lookup stays pinned to checked answers while hostname and TLS identity remain intact', async () => {
  let resolutions = 0;
  const answers = structuredClone(publicAddresses);
  const fake = fakeTransport([{}], (url, options) => {
    assert.equal(url.href, 'https://bloom.app/plants?source=cut');
    assert.equal(options.servername, 'bloom.app');
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.agent, false);
    assert.equal(options.checkServerIdentity, undefined);
    // DNS state changing after validation cannot affect the socket lookup.
    answers[0].address = '127.0.0.1';
    for (let repeat = 0; repeat < 2; repeat++) {
      options.lookup!('bloom.app', { all: true }, (error, addresses) => {
        assert.equal(error, null);
        assert.deepEqual(addresses, publicAddresses);
      });
    }
    options.lookup!('bloom.app', { family: 6 }, (error, address, family) => {
      assert.equal(error, null);
      assert.equal(address, publicAddresses[1].address);
      assert.equal(family, 6);
    });
    options.lookup!('other.app', { all: true }, (error) => assert.ok(error));
  });
  const read = createProductReader({
    resolve: async () => {
      resolutions++;
      return answers;
    },
    request: fake.request,
  });
  const result = await read('https://bloom.app/plants?source=cut');
  assert.equal(result.product, 'Bloom');
  assert.equal(result.description, 'A plant-care app');
  assert.equal(resolutions, 1);
});

void test('public redirects are resolved independently and return metadata for the final URL', async () => {
  const hosts: string[] = [];
  const requested: string[] = [];
  const fake = fakeTransport(
    [
      { status: 302, headers: { location: 'https://www.bloom.app/product' } },
      {},
    ],
    (url) => {
      requested.push(url.href);
    },
  );
  const read = createProductReader({
    resolve: async (host) => {
      hosts.push(host);
      return publicAddresses;
    },
    request: fake.request,
  });
  const result = await read('https://bloom.app');
  assert.deepEqual(hosts, ['bloom.app', 'www.bloom.app']);
  assert.deepEqual(requested, [
    'https://bloom.app/',
    'https://www.bloom.app/product',
  ]);
  assert.equal(result.url, 'https://www.bloom.app/product');
});

void test('a redirect to the same hostname is blocked if its next DNS answer is private', async () => {
  let resolutions = 0;
  const fake = fakeTransport([
    { status: 302, headers: { location: '/second' } },
  ]);
  const read = createProductReader({
    resolve: async () =>
      ++resolutions === 1
        ? publicAddresses
        : [{ address: '127.0.0.1', family: 4 }],
    request: fake.request,
  });
  await assert.rejects(read('https://bloom.app'), /public product website/);
  assert.equal(resolutions, 2);
  assert.equal(
    fake.requests.length,
    1,
    'The second request must never reach the transport',
  );
});

void test('redirects cannot introduce localhost, credentials, private literal IPs or custom ports', async () => {
  for (const location of [
    'http://127.0.0.1',
    'http://[::1]',
    'http://localhost',
    'http://user:pass@bloom.app',
    'https://bloom.app:8443',
  ]) {
    const fake = fakeTransport([{ status: 302, headers: { location } }]);
    let resolutions = 0;
    const read = createProductReader({
      resolve: async () => {
        resolutions++;
        return publicAddresses;
      },
      request: fake.request,
    });
    await assert.rejects(
      read('https://bloom.app'),
      /public product website/,
      location,
    );
    assert.equal(resolutions, 1, location);
    assert.equal(fake.requests.length, 1, location);
  }
});

void test('redirect loops stop after four redirects', async () => {
  const fake = fakeTransport([{ status: 302, headers: { location: '/loop' } }]);
  const read = createProductReader({
    resolve: async () => publicAddresses,
    request: fake.request,
  });
  await assert.rejects(read('https://bloom.app'), /redirects too many times/);
  assert.equal(fake.requests.length, 5);
});

void test('the reader rejects non-HTML, encoded and unsuccessful responses', async () => {
  for (const page of [
    { headers: { 'content-type': 'application/json' } },
    { headers: { 'content-type': 'text/html-malicious' } },
    { headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } },
    { status: 404 },
    { status: 302, headers: {} },
  ]) {
    const fake = fakeTransport([page]);
    const read = createProductReader({
      resolve: async () => publicAddresses,
      request: fake.request,
    });
    await assert.rejects(read('https://bloom.app'), /readable page/);
    assert.equal(fake.responses[0].destroyed, true);
  }
});

void test('large pages retain useful metadata within 700k and stop before reading further chunks', async () => {
  for (const headers of [
    { 'content-type': 'text/html', 'content-length': '900000' },
    { 'content-type': 'text/html' },
  ]) {
    const fake = fakeTransport([
      {
        headers,
        chunks: [
          Buffer.concat([
            Buffer.from(html),
            Buffer.alloc(699995 - Buffer.byteLength(html), ' '),
          ]),
          Buffer.from(
            '     <meta property="og:site_name" content="Wrong product after byte limit">',
          ),
          Buffer.from('<p>This later chunk must never be read.</p>'),
        ],
      },
    ]);
    const read = createProductReader({
      resolve: async () => publicAddresses,
      request: fake.request,
    });
    const result = await read('https://bloom.app');
    assert.equal(
      result.product,
      'Bloom',
      'Metadata after byte 700000 must not enter the result',
    );
    assert.equal(result.description, 'A plant-care app');
    assert.equal(
      fake.deliveredChunks[0],
      2,
      'No additional chunks are consumed after the capped prefix',
    );
    assert.equal(fake.responses[0].destroyed, true);
    assert.equal(fake.requests[0].destroyed, true);
  }
});

void test('a page exactly at the 700k bound completes and closes the connection', async () => {
  const fake = fakeTransport([
    {
      chunks: [
        Buffer.from(html),
        Buffer.alloc(700000 - Buffer.byteLength(html), ' '),
      ],
    },
  ]);
  const read = createProductReader({
    resolve: async () => publicAddresses,
    request: fake.request,
  });
  assert.equal((await read('https://bloom.app')).product, 'Bloom');
  assert.equal(fake.responses[0].destroyed, true);
  assert.equal(fake.requests[0].destroyed, true);
});

void test('DNS that never settles reaches the absolute deadline without opening a connection', async () => {
  let signal: AbortSignal | undefined;
  const read = createProductReader({
    timeoutMs: 20,
    resolve: async (_hostname, currentSignal) => {
      signal = currentSignal;
      return new Promise(() => {});
    },
    request: () => {
      throw new Error('Must not connect before DNS validation');
    },
  });
  await assert.rejects(read('https://bloom.app'), /took too long/);
  assert.equal(signal?.aborted, true);
});

void test('a response that never completes is stopped by the absolute deadline', async () => {
  const fake = fakeTransport([{ hang: true }]);
  const read = createProductReader({
    timeoutMs: 20,
    resolve: async () => publicAddresses,
    request: fake.request,
  });
  await assert.rejects(read('https://bloom.app'), /took too long/);
  assert.equal(fake.requests[0].destroyed, true);
  assert.equal(fake.responses[0].destroyed, true);
});
