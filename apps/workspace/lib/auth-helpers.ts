import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Get user ID from request (from Authorization header or cookies)
 */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  try {
    // Try to get from Authorization header first
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token && supabaseUrl && supabaseAnonKey) {
        const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        const { data: { user }, error } = await verifyClient.auth.getUser(token);
        if (!error && user) {
          return user.id;
        }
      }
    }

    // Try to get from cookies (if session is stored)
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    
    if (accessToken && supabaseUrl && supabaseAnonKey) {
      const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data: { user }, error } = await verifyClient.auth.getUser(accessToken);
      if (!error && user) {
        return user.id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}

