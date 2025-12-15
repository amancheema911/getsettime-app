import { NextResponse } from 'next/server';
import { getUserIntegrations } from '@/lib/integrations';
import { getUserIdFromRequest } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integrations = await getUserIntegrations(userId);

    const status = {
      google_calendar: integrations.some(i => i.type === 'google_calendar'),
      zoom: integrations.some(i => i.type === 'zoom'),
      calendly: integrations.some(i => i.type === 'calendly'),
    };

    return NextResponse.json({ integrations: status });
  } catch (error: any) {
    console.error('Get integrations status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get integrations' },
      { status: 500 }
    );
  }
}

