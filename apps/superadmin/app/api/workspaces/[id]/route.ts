import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// PUT - Update a workspace
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const body = await req.json();
    const { name, slug, primary_color, accent_color, logo_url, billing_customer_id } = body;

    // Validation
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9_-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ 
        error: 'Slug must contain only lowercase letters, numbers, hyphens, and underscores' 
      }, { status: 400 });
    }

    // Validate color format if provided
    if (primary_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(primary_color)) {
      return NextResponse.json({ error: 'Primary color must be a valid hex color' }, { status: 400 });
    }

    if (accent_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(accent_color)) {
      return NextResponse.json({ error: 'Accent color must be a valid hex color' }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();

    // Check if slug already exists for another workspace
    const { data: existing } = await supabaseServer
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    // Update workspace
    console.log('Updating workspace', id, 'with logo_url:', logo_url);
    const { data, error } = await supabaseServer
      .from('workspaces')
      .update({
        name,
        slug,
        primary_color: primary_color || null,
        accent_color: accent_color || null,
        logo_url: logo_url || null,
        billing_customer_id: billing_customer_id || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workspace:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Workspace updated successfully. Saved logo_url:', data?.logo_url);
    return NextResponse.json({ workspace: data }, { status: 200 });
  } catch (err: any) {
    console.error('PUT workspace error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// DELETE - Delete a workspace
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const supabaseServer = getSupabaseServer();

    const { error } = await supabaseServer
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting workspace:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Workspace deleted successfully' }, { status: 200 });
  } catch (err: any) {
    console.error('DELETE workspace error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

