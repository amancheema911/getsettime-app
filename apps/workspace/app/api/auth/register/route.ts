import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Get Supabase URL and anon key
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'server configuration error' }, { status: 500 });
    }

    // Create a client with anon key for user registration
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create user using regular signup (anon key)
    // Note: user_metadata can be set via signup options, but role should be set via database trigger
    // or updated after signup via a separate endpoint with proper RLS policies
    const { data: userData, error: createError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'customer' // This will be in user_metadata, but may need database trigger to ensure it
        },
        emailRedirectTo: undefined // Adjust based on your email confirmation flow
      }
    });

    if (createError) {
      console.error('createError', createError);
      // Handle specific Supabase errors
      const errorMessage = createError.message || '';
      if (errorMessage.includes('already registered') || 
          errorMessage.includes('already exists') ||
          errorMessage.includes('User already registered') ||
          errorMessage.includes('already been registered')) {
        return NextResponse.json({ error: 'This email is already registered. Please login instead.' }, { status: 409 });
      }
      if (errorMessage.includes('Password')) {
        return NextResponse.json({ error: 'Password does not meet requirements. Please use a stronger password.' }, { status: 400 });
      }
      if (errorMessage.includes('Email')) {
        return NextResponse.json({ error: 'Invalid email address. Please check and try again.' }, { status: 400 });
      }
      return NextResponse.json({ error: errorMessage || 'Failed to create user. Please try again.' }, { status: 400 });
    }

    if (!userData || !userData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    return NextResponse.json({ 
      user: userData.user,
      message: 'User created successfully' 
    }, { status: 201 });
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred during registration' 
    }, { status: 500 });
  }
}

