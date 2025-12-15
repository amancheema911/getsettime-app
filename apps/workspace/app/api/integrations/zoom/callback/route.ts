import { NextResponse } from 'next/server';
import { getZoomTokens } from '@/lib/zoomClient';
import { saveIntegration } from '@/lib/integrations';
import { getUserIdFromRequest } from '@/lib/auth-helpers';
import axios from 'axios';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // user_id

    if (!code || !state) {
      return NextResponse.redirect(new URL('/integrations?error=missing_params', req.url));
    }

    const userId = await getUserIdFromRequest(req) || state;

    const redirectUri = process.env.ZOOM_REDIRECT_URI || `${req.url.split('/callback')[0]}/callback`;

    // Exchange code for tokens
    const tokenResponse = await getZoomTokens(code, redirectUri);
    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token) {
      return NextResponse.redirect(new URL('/integrations?error=no_token', req.url));
    }

    // Get user info from Zoom
    const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    // Save integration
    const expiresAt = expires_in ? Date.now() / 1000 + expires_in : undefined;
    const saved = await saveIntegration({
      user_id: userId,
      type: 'zoom',
      access_token,
      refresh_token,
      expires_at: expiresAt,
      metadata: {
        zoom_user_id: userResponse.data.id,
        zoom_email: userResponse.data.email,
      },
    });

    if (!saved) {
      return NextResponse.redirect(new URL('/integrations?error=save_failed', req.url));
    }

    return NextResponse.redirect(new URL('/integrations?success=zoom_connected', req.url));
  } catch (error: any) {
    console.error('Zoom callback error:', error);
    return NextResponse.redirect(new URL('/integrations?error=callback_failed', req.url));
  }
}

