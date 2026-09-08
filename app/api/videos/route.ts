import { readLimited, runtime } from '@/lib/server';
export async function POST(request:Request){
  try{
    if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Please upload from the app.'},{status:403});
    const ticket=request.headers.get('x-render-ticket')||'';if(!/^[0-9a-f-]{36}$/.test(ticket))return Response.json({error:'Start a new video in the chat first.'},{status:403});
    const files=runtime().FILES;const raw=await files.get(`tickets/${ticket}`);const permit=raw?await raw.json<{expires:number;product:string}>():null;
    if(!permit||permit.expires<Date.now())return Response.json({error:'This render expired. Please try again.'},{status:403});
    const type=request.headers.get('content-type')?.split(';')[0];if(!['video/mp4','video/webm'].includes(type||''))return Response.json({error:'Unsupported video format.'},{status:400});
    if(Number(request.headers.get('content-length'))>12000000)return Response.json({error:'The video is too large.'},{status:413});
    const bytes=await readLimited(request,12000000);const isMp4=new TextDecoder().decode(bytes.slice(4,8))==='ftyp';const isWebm=bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
    if(bytes.length<10000||(type==='video/mp4'?!isMp4:!isWebm))return Response.json({error:'That video did not encode correctly. Please try again.'},{status:400});
    const id=`${crypto.randomUUID()}.${isMp4?'mp4':'webm'}`;
    await files.put(`videos/${id}`,bytes,{httpMetadata:{contentType:type,cacheControl:'public, max-age=31536000, immutable'},customMetadata:{product:permit.product}});
    await files.delete(`tickets/${ticket}`);
    return Response.json({url:`/api/videos/${id}`});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Could not save the video.'},{status:400});}
}
