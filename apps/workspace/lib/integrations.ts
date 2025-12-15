import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side Supabase client with service role key for admin operations
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export type IntegrationType = 'google_calendar' | 'zoom' | 'calendly';

export interface Integration {
  id?: string;
  user_id: string;
  type: IntegrationType;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get integration for a user
 */
export async function getIntegration(userId: string, type: IntegrationType): Promise<Integration | null> {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not configured');
    return null;
  }

  const { data, error } = await supabaseAdmin.from('integrations').select('*').eq('user_id', userId).eq('type', type).single();
  if (error || !data) {
    return null;
  }

  return data as Integration;
}

/**
 * Save or update integration
 */
export async function saveIntegration(integration: Integration): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not configured');
    return false;
  }

  const { error } = await supabaseAdmin.from('integrations').upsert({
      user_id: integration.user_id,
      type: integration.type,
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expires_at: integration.expires_at,
      metadata: integration.metadata,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,type'
    });

  return !error;
}

/**
 * Delete integration
 */
export async function deleteIntegration(userId: string, type: IntegrationType): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not configured');
    return false;
  }

  const { error } = await supabaseAdmin.from('integrations').delete().eq('user_id', userId).eq('type', type);

  return !error;
}

/**
 * Get all integrations for a user
 */
export async function getUserIntegrations(userId: string): Promise<Integration[]> {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not configured');
    return [];
  }

  const { data, error } = await supabaseAdmin.from('integrations').select('*').eq('user_id', userId);

  if (error || !data) {
    return [];
  }

  return data as Integration[];
}

