import { runtime } from '@/lib/server';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;if(!/^[0-9a-f-]{36}\.(mp4|webm)$/.test(id))return new Response('Video not found',{status:404});
  const object=await runtime().FILES.get(`videos/${id}`,{range:request.headers});if(!object)return new Response('Video not found',{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('ETag',object.httpEtag);headers.set('Accept-Ranges','bytes');headers.set('X-Content-Type-Options','nosniff');
  if(new URL(request.url).searchParams.has('download'))headers.set('Content-Disposition',`attachment; filename="cut-${id}"`);
  const range=object.range as {offset?:number;length?:number}|undefined;
  if(range&&range.offset!==undefined&&range.length!==undefined){headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${object.size}`);headers.set('Content-Length',String(range.length));return new Response(object.body,{status:206,headers});}
  headers.set('Content-Length',String(object.size));return new Response(object.body,{headers});
}
