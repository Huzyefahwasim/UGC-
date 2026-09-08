import { runtime } from '@/lib/server';
export async function GET(){return Response.json({status:'ok',aiConfigured:!!runtime().OPENAI_API_KEY,storageConfigured:!!runtime().FILES});}
