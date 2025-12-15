import axios from 'axios';

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  slug: string;
  scheduling_url: string;
  timezone: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendlyEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  event_type: string;
  location?: string;
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Get Calendly API client with access token
 */
export function getCalendlyApiClient(accessToken: string) {
  return axios.create({
    baseURL: 'https://api.calendly.com',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Get current user info from Calendly
 */
export async function getCalendlyUser(accessToken: string): Promise<CalendlyUser> {
  const client = getCalendlyApiClient(accessToken);
  const response = await client.get('/users/me');
  return response.data.resource;
}

/**
 * Get user's event types
 */
export async function getCalendlyEventTypes(accessToken: string, userUri: string): Promise<CalendlyEvent[]> {
  const client = getCalendlyApiClient(accessToken);
  const response = await client.get('/event_types', {
    params: {
      user: userUri,
    },
  });
  return response.data.collection || [];
}

/**
 * Get scheduled events
 */
export async function getCalendlyEvents(accessToken: string, userUri: string, params?: {
  count?: number;
  page_token?: string;
  sort?: string;
  status?: 'active' | 'canceled';
  min_start_time?: string;
  max_start_time?: string;
}): Promise<{ collection: any[]; pagination: any }> {
  const client = getCalendlyApiClient(accessToken);
  const response = await client.get('/scheduled_events', {
    params: {
      user: userUri,
      ...params,
    },
  });
  return response.data;
}

