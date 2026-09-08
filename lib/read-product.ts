import { safeUrl, publicAddress, metadata } from './product';
import { readLimited } from './server';
export async function readProduct(raw:string) {
  let url=safeUrl(raw);
  for(let redirects=0;redirects<4;redirects++){
    const dns=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(url.hostname)}&type=A`,{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(5000)});
    if(!dns.ok)throw new Error('Could not check that website.');
    const answer=await dns.json() as {Answer?:{type:number;data:string}[]};const addresses=answer.Answer?.filter(a=>a.type===1)||[];
    if(!addresses.length||addresses.some(a=>!publicAddress(a.data)))throw new Error('Please send a public product website URL.');
    const response=await fetch(url.href,{redirect:'manual',headers:{'User-Agent':'CutProductReader/1.0','Accept':'text/html'},signal:AbortSignal.timeout(7000)});
    if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)break;url=safeUrl(new URL(location,url).href);continue;}
    if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))throw new Error('That website did not share a readable page. Tell me the product name and what it does, and I can work from that.');
    const bytes=await readLimited(response,700000);return {...metadata(new TextDecoder().decode(bytes),url.href),url:url.href};
  }
  throw new Error('That website redirects too many times. Please send its final product URL.');
}
