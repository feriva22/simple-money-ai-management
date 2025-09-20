import { NextResponse } from 'next/server';

export async function GET(request) {
  const { NEXT_PUBLIC_FIREFLY_III_API_URL, FIREFLY_III_CLIENT_ID } = process.env;
  
  // Construct the redirect URI from the request headers
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const redirectUri = `${proto}://${host}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: FIREFLY_III_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: '*', // Request all available scopes
  });

  const authorizationUrl = `${NEXT_PUBLIC_FIREFLY_III_API_URL}/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(authorizationUrl);
}
