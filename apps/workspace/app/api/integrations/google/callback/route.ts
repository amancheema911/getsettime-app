import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleClient';
import { saveIntegration } from '@/lib/integrations';
import { getUserIdFromRequest } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // user_id
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Google
    if (error) {
      console.error('Google OAuth error:', error, errorDescription);
      const errorMessage = errorDescription || error;
      return NextResponse.redirect(
        new URL(`/integrations?error=oauth_error&message=${encodeURIComponent(errorMessage)}`, req.url)
      );
    }

    if (!code || !state) {
      console.error('Missing OAuth parameters:', { code: !!code, state: !!state });
      return NextResponse.redirect(new URL('/integrations?error=missing_params', req.url));
    }

    // Try to get from request, fallback to state
    const userId = await getUserIdFromRequest(req) || state;

    if (!userId) {
      console.error('No user ID found');
      return NextResponse.redirect(new URL('/integrations?error=unauthorized', req.url));
    }

    // Construct redirect URI dynamically (must match the one used in connect route)
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/integrations/google/callback`;

    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials not configured');
      return NextResponse.redirect(new URL('/integrations?error=config_missing', req.url));
    }

    const oauth2Client = getGoogleOAuthClient(redirectUri);
    
    try {
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        console.error('No access token received from Google');
        return NextResponse.redirect(new URL('/integrations?error=no_token', req.url));
      }

      // Save integration
      const saved = await saveIntegration({
        user_id: userId,
        type: 'google_calendar',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        metadata: {
          scope: tokens.scope,
        },
      });

      if (!saved) {
        console.error('Failed to save integration');
        return NextResponse.redirect(new URL('/integrations?error=save_failed', req.url));
      }

      console.log('Google Calendar connected successfully for user:', userId);
      return NextResponse.redirect(new URL('/integrations?success=google_connected', req.url));
    } catch (tokenError: any) {
      console.error('Error exchanging code for token:', tokenError);
      // Check for specific Google OAuth errors
      if (tokenError.message?.includes('redirect_uri_mismatch')) {
        console.error('Redirect URI mismatch. Expected:', redirectUri);
        return NextResponse.redirect(
          new URL('/integrations?error=redirect_uri_mismatch', req.url)
        );
      }
      throw tokenError;
    }
  } catch (error: any) {
    console.error('Google callback error:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    return NextResponse.redirect(
      new URL(`/integrations?error=callback_failed&message=${encodeURIComponent(errorMessage)}`, req.url)
    );
  }
}

