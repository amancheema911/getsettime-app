import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.ZOOM_CLIENT_ID;
    const redirectUri = process.env.ZOOM_REDIRECT_URI || `${req.url.split('/api')[0]}/api/integrations/zoom/callback`;

    if (!clientId) {
      return NextResponse.json({ error: 'Zoom client ID not configured' }, { status: 500 });
    }

    const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;

    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Zoom OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}

