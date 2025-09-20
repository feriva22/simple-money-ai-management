import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '../../../../lib/session';

export async function GET(request) {
  const session = await getIronSession(cookies(), sessionOptions);
  session.destroy();
  return NextResponse.redirect(new URL('/', request.url));
}
