import { NextResponse } from 'next/server';
import { deleteIntegration, IntegrationType } from '@/lib/integrations';
import { getUserIdFromRequest } from '@/lib/auth-helpers';

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json();
    const { type } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!type || !['google_calendar', 'zoom', 'calendly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
    }

    const deleted = await deleteIntegration(userId, type as IntegrationType);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Disconnect integration error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect' },
      { status: 500 }
    );
  }
}

