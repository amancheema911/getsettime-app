import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET - Fetch paginated bookings across all workspaces
export async function GET(request: NextRequest) {
  try {
    const supabaseServer = getSupabaseServer();
    const searchParams = request.nextUrl.searchParams;
    
    // Parse pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;
    
    // Parse sorting parameters
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const ascending = sortOrder === 'asc';
    
    // Parse filter parameter
    const filter = searchParams.get('filter') || '';
    
    // Build query
    let query = supabaseServer
      .from('bookings')
      .select('*', { count: 'exact' });
    
    // Apply filter if provided (search in invitee_name, invitee_email, or workspace name)
    if (filter) {
      const filterPattern = `%${filter}%`;
      
      // First, check if filter matches any workspace names
      const { data: matchingWorkspaces } = await supabaseServer
        .from('workspaces')
        .select('id')
        .ilike('name', filterPattern);
      
      const workspaceIds = matchingWorkspaces?.map(w => w.id) || [];
      
      // Build filter: name/email OR workspace_id in matching workspaces
      if (workspaceIds.length > 0) {
        // Use or() with in() for workspace IDs
        query = query.or(`invitee_name.ilike.${filterPattern},invitee_email.ilike.${filterPattern},workspace_id.in.(${workspaceIds.join(',')})`);
      } else {
        // Only filter by name/email if no workspace matches
        query = query.or(`invitee_name.ilike.${filterPattern},invitee_email.ilike.${filterPattern}`);
      }
    }
    
    // Apply sorting
    const validSortFields: Record<string, string> = {
      'date': 'start_at',
      'name': 'invitee_name',
      'workspace': 'workspace_id',
      'created_at': 'created_at',
    };
    
    const sortField = validSortFields[sortBy] || 'created_at';
    query = query.order(sortField, { ascending });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: bookings, error, count } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({ 
      bookings: bookings || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
      }
    }, { status: 200 });
  } catch (err: any) {
    console.error('GET bookings error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

