'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import type { WorkspaceSettings, WorkspaceSettingsHook } from '../types/workspace';

/**
 * Custom hook to fetch and manage workspace settings from the configuration table.
 * 
 * @returns {WorkspaceSettingsHook} Object containing:
 *   - settings: Full workspace settings object
 *   - general: General settings (accountName, logoUrl, primaryColor, accentColor)
 *   - availability: Availability settings (grid, individual, timesheet)
 *   - loading: Loading state
 *   - error: Error object if fetch failed
 *   - refetch: Function to manually refetch settings
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { general, availability, loading, error } = useWorkspaceSettings();
 * 
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 * 
 *   return (
 *     <div>
 *       <h1>{general.accountName || 'GetSetTime'}</h1>
 *       <img src={general.logoUrl || '/default-logo.svg'} alt="Logo" />
 *       <p>Primary Color: {general.primaryColor}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkspaceSettings(): WorkspaceSettingsHook {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WorkspaceSettings>({});
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceLogo, setWorkspaceLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const token = session.access_token;

      // Fetch settings and workspace data in parallel
      const [settingsResponse, workspaceResponse] = await Promise.all([
        fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch('/api/workspace', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
      ]);

      if (!settingsResponse.ok) {
        throw new Error('Failed to fetch workspace settings');
      }

      const settingsResult = await settingsResponse.json();
      const fetchedSettings = settingsResult.settings || {};
      setSettings(fetchedSettings);

      // Handle workspace data (non-critical if it fails)
      if (workspaceResponse.ok) {
        const workspaceResult = await workspaceResponse.json();
        if (workspaceResult?.workspace) {
          setWorkspaceName(workspaceResult.workspace.name || null);
          setWorkspaceLogo(workspaceResult.workspace.logo_url || null);
        }
      } else {
        // Workspace fetch failed, but don't throw error as it's non-critical
        console.warn('Failed to fetch workspace data:', await workspaceResponse.json().catch(() => ({})));
        setWorkspaceName(null);
        setWorkspaceLogo(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error('Error fetching workspace settings:', error);
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    general: settings.general || {},
    availability: settings.availability || {},
    workspaceName,
    workspaceLogo,
    loading,
    error,
    refetch: fetchSettings,
  };
}

