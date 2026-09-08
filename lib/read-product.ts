import { Resolver } from 'node:dns/promises';
import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
} from 'node:http';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { safeUrl, metadata } from './product.ts';

const MAX_BYTES = 700000;
const MAX_REDIRECTS = 4;
const PUBLIC_URL_ERROR = 'Please send a public product website URL.';
const READ_ERROR =
  'That website did not share a readable page. Tell me the product name and what it does, and I can work from that.';
const TIMEOUT_ERROR =
  'That website took too long to respond. Tell me the product name and what it does.';

export type ResolvedAddress = { address: string; family: 4 | 6 };
type Resolve = (
  hostname: string,
  signal: AbortSignal,
) => Promise<ResolvedAddress[]>;
type Transport = (
  url: URL,
  options: RequestOptions,
  callback: (response: IncomingMessage) => void,
) => ClientRequest;
type Dependencies = {
  resolve?: Resolve;
  request?: Transport;
  timeoutMs?: number;
};
type Page = { location: string } | { html: string };

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(address, prefix, 'ipv4');
// Only globally allocated unicast IPv6 is eligible. Translation/tunnel ranges
// cannot be used to reach an otherwise rejected IPv4 destination.
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  blocked.addSubnet(address, prefix, 'ipv6');

export function validateResolvedAddresses(
  addresses: ResolvedAddress[],
): ResolvedAddress[] {
  if (
    !addresses.length ||
    addresses.some(({ address, family }) => {
      if (isIP(address) !== family) return true;
      if (family === 4) return blocked.check(address, 'ipv4');
      return !globalV6.check(address, 'ipv6') || blocked.check(address, 'ipv6');
    })
  )
    throw new Error(PUBLIC_URL_ERROR);
  return addresses.map(({ address, family }) => ({ address, family }));
}

async function resolvePublicHost(
  hostname: string,
  signal: AbortSignal,
): Promise<ResolvedAddress[]> {
  signal.throwIfAborted();
  const resolver = new Resolver({ timeout: 5000, tries: 1 });
  const abort = () => resolver.cancel();
  signal.addEventListener('abort', abort, { once: true });
  const optionalFamily = async (query: Promise<string[]>, family: 4 | 6) => {
    try {
      return (await query).map((address) => ({ address, family }));
    } catch (error) {
      signal.throwIfAborted();
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENODATA' || code === 'ENOTFOUND') return [];
      throw new Error('Could not check that website. Please try again.');
    }
  };
  try {
    const addresses = await Promise.all([
      optionalFamily(resolver.resolve4(hostname), 4),
      optionalFamily(resolver.resolve6(hostname), 6),
    ]);
    return addresses.flat();
  } finally {
    signal.removeEventListener('abort', abort);
    resolver.cancel();
  }
}

function bounded<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

function pinnedLookup(
  hostname: string,
  addresses: ResolvedAddress[],
): LookupFunction {
  return (requestedHost, options, callback) => {
    if (requestedHost !== hostname) {
      callback(new Error(PUBLIC_URL_ERROR), '');
      return;
    }
    const eligible = addresses.filter(
      ({ family }) =>
        !options.family ||
        options.family === family ||
        options.family === (family === 4 ? 'IPv4' : 'IPv6'),
    );
    if (!eligible.length) {
      callback(new Error('That website has no reachable public address.'), '');
      return;
    }
    if (options.all)
      callback(
        null,
        eligible.map((address) => ({ ...address })),
      );
    else callback(null, eligible[0].address, eligible[0].family);
  };
}

const nativeRequest: Transport = (url, options, callback) =>
  url.protocol === 'https:'
    ? httpsRequest(url, options, callback)
    : httpRequest(url, options, callback);

function requestPage(
  url: URL,
  addresses: ResolvedAddress[],
  signal: AbortSignal,
  transport: Transport,
): Promise<Page> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let request: ClientRequest | undefined;
    let response: IncomingMessage | undefined;
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', abort);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      response?.destroy();
      request?.destroy();
      reject(error);
    };
    const done = (page: Page) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(page);
    };
    const abort = () =>
      fail(
        signal.reason instanceof Error
          ? signal.reason
          : new Error(TIMEOUT_ERROR),
      );
    signal.addEventListener('abort', abort, { once: true });
    try {
      request = transport(
        url,
        {
          method: 'GET',
          // A new socket uses only these checked answers, never another DNS lookup
          // or a pooled connection. The URL hostname still drives Host and TLS.
          agent: false,
          lookup: pinnedLookup(url.hostname, addresses),
          servername: url.protocol === 'https:' ? url.hostname : undefined,
          rejectUnauthorized: true,
          signal,
          maxHeaderSize: 16384,
          headers: {
            'User-Agent': 'CutProductReader/1.0',
            Accept: 'text/html',
            'Accept-Encoding': 'identity',
          },
        },
        (incoming) => {
          response = incoming;
          incoming.on('error', fail);
          if (settled) {
            incoming.destroy();
            return;
          }
          const status = incoming.statusCode || 0;
          if (status >= 300 && status < 400) {
            const location = incoming.headers.location;
            if (!location) {
              fail(new Error(READ_ERROR));
              return;
            }
            done({ location });
            incoming.destroy();
            return;
          }
          const contentType = incoming.headers['content-type'] || '';
          const encoding = incoming.headers['content-encoding'];
          if (
            status < 200 ||
            status >= 300 ||
            !/^text\/html(?:\s*;|\s*$)/i.test(contentType) ||
            (encoding && encoding !== 'identity')
          ) {
            fail(new Error(READ_ERROR));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          incoming.on('data', (chunk: Buffer) => {
            if (settled) return;
            const remaining = MAX_BYTES - size;
            const kept =
              chunk.length > remaining
                ? Buffer.from(chunk.subarray(0, remaining))
                : chunk;
            chunks.push(kept);
            size += kept.length;
            if (size === MAX_BYTES) {
              // Large sites often put useful product metadata before their
              // scripts. Keep that bounded prefix and stop downloading.
              done({ html: Buffer.concat(chunks).toString('utf8') });
              incoming.destroy();
              request?.destroy();
            }
          });
          incoming.on('aborted', () => fail(new Error(READ_ERROR)));
          incoming.on('end', () =>
            done({ html: Buffer.concat(chunks).toString('utf8') }),
          );
        },
      );
      request.on('error', fail);
      request.end();
    } catch (error) {
      fail(error instanceof Error ? error : new Error(READ_ERROR));
    }
  });
}

// Injectable boundaries allow DNS/redirect/body-limit tests without opening
// sockets or contacting any private network.
export function createProductReader({
  resolve = resolvePublicHost,
  request = nativeRequest,
  timeoutMs = 7000,
}: Dependencies = {}) {
  return async function readProduct(raw: string) {
    let url = safeUrl(raw);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error(TIMEOUT_ERROR)),
        timeoutMs,
      );
      try {
        const answers = await bounded(
          resolve(url.hostname, controller.signal),
          controller.signal,
        );
        const addresses = validateResolvedAddresses(answers);
        const page = await requestPage(
          url,
          addresses,
          controller.signal,
          request,
        );
        if ('location' in page) {
          url = safeUrl(new URL(page.location, url).href);
          continue;
        }
        return { ...metadata(page.html, url.href), url: url.href };
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(
      'That website redirects too many times. Please send its final product URL.',
    );
  };
}

export const readProduct = createProductReader();
