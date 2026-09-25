import { NextRequest, NextResponse } from 'next/server';
import { apiContext } from '@/lib/api-auth';
import { openapi } from '@/lib/openapi';
export async function GET(req:NextRequest) {
  if (!await apiContext(req)) return NextResponse.json({error:'Authentification ou rôle non autorisé.'},{status:401});
  return NextResponse.json(openapi,{headers:{'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="camionnage-openapi.json"'}});
}
