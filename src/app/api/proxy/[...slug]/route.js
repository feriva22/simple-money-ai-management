import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '../../../../lib/session';
import axios from 'axios';
import https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false,
});

async function handleProxy(request) {
    const session = await getIronSession(cookies(), sessionOptions);
    let user = session.user;

    if (!user || !user.accessToken) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Token refresh logic
    if (Date.now() >= user.expiresAt) {
        try {
            const { NEXT_PUBLIC_FIREFLY_III_API_URL, FIREFLY_III_CLIENT_ID, FIREFLY_III_CLIENT_SECRET } = process.env;
            const response = await axios.post(`${NEXT_PUBLIC_FIREFLY_III_API_URL}/oauth/token`, {
                grant_type: 'refresh_token',
                client_id: FIREFLY_III_CLIENT_ID,
                client_secret: FIREFLY_III_CLIENT_SECRET,
                refresh_token: user.refreshToken,
            }, { httpsAgent: agent });

            const { access_token, refresh_token, expires_in } = response.data;
            session.user = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: Date.now() + expires_in * 1000,
            };
            await session.save();
            user = session.user;
        } catch (error) {
            console.error('Error refreshing token', error.response?.data || error.message);
            session.destroy();
            return new NextResponse('Session expired, please log in again.', { status: 401 });
        }
    }

    // Forward the request to Firefly III API
    const url = new URL(request.url);
    const slug = url.pathname.replace('/api/proxy/', '');
    const apiUrl = `${process.env.NEXT_PUBLIC_FIREFLY_III_API_URL}/api/v1/${slug}${url.search}`;

    try {
        const body = request.method === 'POST' || request.method === 'PUT' ? await request.json() : undefined;

        const response = await axios({
            method: request.method,
            url: apiUrl,
            headers: {
                'Authorization': `Bearer ${user.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            data: body,
            httpsAgent: agent,
        });

        return new NextResponse(JSON.stringify(response.data), { status: response.status });
    } catch (error) {
        console.error(`Error proxying to ${apiUrl}`, error.response?.data || error.message);
        return new NextResponse(JSON.stringify(error.response?.data || { message: 'An error occurred' }), { status: error.response?.status || 500 });
    }
}

export { handleProxy as GET, handleProxy as POST, handleProxy as PUT, handleProxy as DELETE };
