import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'crypto';

export interface CreateSessionParams {
  email: string;
  userId: string;
  supabaseAdmin: SupabaseClient;
  supabaseClient: SupabaseClient;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Create a session for a user using temporary password flow
 */
export async function createUserSession(
  params: CreateSessionParams
): Promise<{ data: SessionResult | null; error: string | null }> {
  const { email, userId, supabaseAdmin, supabaseClient } = params;

  try {
    // Generate temporary password
    const tempPassword = `temp_${Date.now()}_${randomBytes(16).toString('hex')}`;

    // Update user with temporary password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) {
      console.error('Failed to set temporary password:', updateError);
      return { data: null, error: 'Failed to create session' };
    }

    // Sign in with temporary password
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password: tempPassword,
    });

    if (signInError || !signInData.session) {
      console.error('Sign in error:', signInError);
      return { data: null, error: 'Failed to create session' };
    }

    return {
      data: {
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token ?? '',
      },
      error: null,
    };
  } catch (err) {
    console.error('createUserSession error:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export interface StoreCallbackTokenParams {
  accessToken: string;
  refreshToken: string;
  supabaseAdmin: SupabaseClient;
}

/**
 * Store callback tokens in database
 */
export async function storeCallbackToken(
  params: StoreCallbackTokenParams
): Promise<{ callbackId: string | null; error: string | null }> {
  const { accessToken, refreshToken, supabaseAdmin } = params;

  try {
    const callbackId = randomUUID();
    const { error: insertError } = await supabaseAdmin.from('auth_callback_tokens').insert({
      id: callbackId,
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (insertError) {
      console.error('Failed to store callback token:', insertError);
      return { callbackId: null, error: 'Failed to store callback token' };
    }

    return { callbackId, error: null };
  } catch (err) {
    console.error('storeCallbackToken error:', err);
    return {
      callbackId: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export interface SaveGoogleIntegrationParams {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  scope?: string;
  email: string;
  supabaseAdmin: SupabaseClient;
}

/**
 * Save Google Calendar integration
 */
export async function saveGoogleCalendarIntegration(
  params: SaveGoogleIntegrationParams
): Promise<{ error: string | null }> {
  const { userId, accessToken, refreshToken, expiresAt, scope, email, supabaseAdmin } = params;

  try {
    const { error: integrationError } = await supabaseAdmin
      .from('integrations')
      .upsert(
        {
          user_id: userId,
          type: 'google_calendar',
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt ? Math.floor(expiresAt / 1000) : undefined,
          metadata: { scope, email },
        },
        { onConflict: 'user_id,type' }
      );

    if (integrationError) {
      console.warn('Failed to save Google Calendar integration:', integrationError);
      return { error: 'Failed to save calendar integration' };
    }

    return { error: null };
  } catch (err) {
    console.error('saveGoogleCalendarIntegration error:', err);
    return {
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
