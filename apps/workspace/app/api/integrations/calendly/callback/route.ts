import { NextResponse } from 'next/server';
import { saveIntegration } from '@/lib/integrations';
import { getUserIdFromRequest } from '@/lib/auth-helpers';
import { getCalendlyUser } from '@/lib/calendlyClient';
import axios from 'axios';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // user_id
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Calendly
    if (error) {
      console.error('Calendly OAuth error:', error, errorDescription);
      const errorMessage = errorDescription || error;
      return NextResponse.redirect(
        new URL(`/integrations?error=oauth_error&message=${encodeURIComponent(errorMessage)}`, req.url)
      );
    }

    // If API key + scheduling link are configured, connect immediately without OAuth
    const calendlyApiKey = process.env.CALENDLY_API_KEY;
    const calendlySchedulingLink = process.env.CALENDLY_SCHEDULING_LINK;

    const userIdFromReq = await getUserIdFromRequest(req);
    const userId = userIdFromReq || state;

    if (calendlyApiKey && calendlySchedulingLink) {
      if (!userId) {
        console.error('No user ID found for API key flow');
        return NextResponse.redirect(new URL('/integrations?error=unauthorized', req.url));
      }

      const saved = await saveIntegration({
        user_id: userId,
        type: 'calendly',
        access_token: calendlyApiKey,
        metadata: {
          scheduling_link: calendlySchedulingLink,
          connection_type: 'api_key',
        },
      });

      if (!saved) {
        console.error('Failed to save integration via API key flow');
        return NextResponse.redirect(new URL('/integrations?error=save_failed', req.url));
      }

      console.log('Calendly connected successfully via API key for user:', userId);
      return NextResponse.redirect(new URL('/integrations?success=calendly_connected', req.url));
    }

    if (!code || !state) {
      console.error('Missing OAuth parameters:', { code: !!code, state: !!state });
      return NextResponse.redirect(new URL('/integrations?error=missing_params', req.url));
    }

    if (!userId) {
      console.error('No user ID found');
      return NextResponse.redirect(new URL('/integrations?error=unauthorized', req.url));
    }

    // Construct redirect URI dynamically (must match the one used in connect route)
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/integrations/calendly/callback`;

    // Validate environment variables
    if (!process.env.CALENDLY_CLIENT_ID || !process.env.CALENDLY_CLIENT_SECRET) {
      console.error('Calendly OAuth credentials not configured');
      return NextResponse.redirect(new URL('/integrations?error=config_missing', req.url));
    }

    const clientId = process.env.CALENDLY_CLIENT_ID;
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET;

    try {
      // Exchange code for tokens
      const tokenResponse = await axios.post(
        'https://auth.calendly.com/oauth/token',
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      if (!access_token) {
        console.error('No access token received from Calendly');
        return NextResponse.redirect(new URL('/integrations?error=no_token', req.url));
      }

      // Get user info from Calendly using the helper
      const calendlyUser = await getCalendlyUser(access_token);

      // Save integration
      const expiresAt = expires_in ? Date.now() / 1000 + expires_in : undefined;
      const saved = await saveIntegration({
        user_id: userId,
        type: 'calendly',
        access_token,
        refresh_token: refresh_token || undefined,
        expires_at: expiresAt,
        metadata: {
          calendly_uri: calendlyUser.uri,
          calendly_email: calendlyUser.email,
          calendly_name: calendlyUser.name,
          scheduling_url: calendlyUser.scheduling_url,
          timezone: calendlyUser.timezone,
        },
      });

      if (!saved) {
        console.error('Failed to save integration');
        return NextResponse.redirect(new URL('/integrations?error=save_failed', req.url));
      }

      console.log('Calendly connected successfully for user:', userId);
      return NextResponse.redirect(new URL('/integrations?success=calendly_connected', req.url));
    } catch (tokenError: any) {
      console.error('Error exchanging code for token:', tokenError);
      // Check for specific Calendly OAuth errors
      if (tokenError.response?.data?.error === 'invalid_grant' || tokenError.message?.includes('redirect_uri_mismatch')) {
        console.error('Redirect URI mismatch. Expected:', redirectUri);
        return NextResponse.redirect(
          new URL('/integrations?error=redirect_uri_mismatch', req.url)
        );
      }
      throw tokenError;
    }
  } catch (error: any) {
    console.error('Calendly callback error:', error);
    const errorMessage = error.response?.data?.error_description || error.message || 'Unknown error occurred';
    return NextResponse.redirect(
      new URL(`/integrations?error=callback_failed&message=${encodeURIComponent(errorMessage)}`, req.url)
    );
  }
}

