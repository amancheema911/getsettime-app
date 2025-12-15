import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-helpers';
import { saveIntegration } from '@/lib/integrations';

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If an API key + scheduling link are provided, connect immediately without OAuth
    const calendlyApiKey = process.env.CALENDLY_API_KEY;
    const calendlySchedulingLink = process.env.CALENDLY_SCHEDULING_LINK;

    console.log('calendlyApiKey', calendlyApiKey);
    console.log('calendlySchedulingLink', calendlySchedulingLink);
    
    if (calendlyApiKey && calendlySchedulingLink) {
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
        console.error('Failed to save Calendly integration');
        return NextResponse.json({ error: 'Failed to save Calendly integration' }, { status: 500 });
      }

      console.log('Calendly connected successfully via API key for user:', userId);
      return NextResponse.json({ success: true });
    }

    // If no API key setup, require OAuth credentials; otherwise fail fast
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/integrations/calendly/callback`;

    // Validate environment variables
    if (!process.env.CALENDLY_CLIENT_ID || !process.env.CALENDLY_CLIENT_SECRET) {
      console.error('Calendly API key not configured and OAuth credentials missing');
      return NextResponse.json(
        { error: 'Calendly not configured. Please set CALENDLY_API_KEY and CALENDLY_SCHEDULING_LINK, or configure CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET for OAuth.' },
        { status: 500 }
      );
    }

    const clientId = process.env.CALENDLY_CLIENT_ID;
    const authUrl = `https://auth.calendly.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;

    console.log('Generated Calendly OAuth URL with redirect URI:', redirectUri);
    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Calendly OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}

