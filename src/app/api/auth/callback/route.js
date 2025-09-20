import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '../../../../lib/session';
import axios from 'axios';

export async function GET(request) {
  const session = await getIronSession(cookies(), sessionOptions);
  
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  const { NEXT_PUBLIC_FIREFLY_III_API_URL, FIREFLY_III_CLIENT_ID, FIREFLY_III_CLIENT_SECRET } = process.env;
  
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const redirectUri = `${proto}://${host}/api/auth/callback`;

  try {
    const response = await axios.post(`${NEXT_PUBLIC_FIREFLY_III_API_URL}/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: FIREFLY_III_CLIENT_ID,
      client_secret: FIREFLY_III_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code: code,
    });

    const { access_token, refresh_token, expires_in } = response.data;

    session.user = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
    };
    await session.save();

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error getting token', error.response?.data || error.message);
    return new NextResponse('Authentication failed', { status: 500 });
  }
}
