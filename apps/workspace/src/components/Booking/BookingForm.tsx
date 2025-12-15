"use client";

import React, { useState, useEffect } from 'react';
import type { Booking } from '@/src/types/booking';

interface EventType {
  id: string;
  title: string;
}

interface BookingFormProps {
  booking?: Booking | null;
  onSave: () => void;
  onCancel: () => void;
}

const BookingForm = ({ booking, onSave, onCancel }: BookingFormProps) => {
  const [formData, setFormData] = useState({
    invitee_name: '',
    invitee_email: '',
    invitee_phone: '',
    start_at: '',
    end_at: '',
    status: 'pending',
    event_type_id: '',
  });
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          return;
        }

        const response = await fetch('/api/event-types', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setEventTypes(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching event types:', error);
      } finally {
        setLoadingEventTypes(false);
      }
    };

    fetchEventTypes();
  }, []);

  useEffect(() => {
    if (booking) {
      const startDate = booking.start_at ? new Date(booking.start_at).toISOString().slice(0, 16) : '';
      const endDate = booking.end_at ? new Date(booking.end_at).toISOString().slice(0, 16) : '';
      setFormData({
        invitee_name: booking.invitee_name || '',
        invitee_email: booking.invitee_email || '',
        invitee_phone: booking.invitee_phone || '',
        start_at: startDate,
        end_at: endDate,
        status: booking.status || 'pending',
        event_type_id: booking.event_type_id || '',
      });
    }
  }, [booking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const url = '/api/bookings';
      const method = booking ? 'PATCH' : 'POST';
      
      // Convert datetime-local format to ISO string
      const submitData = {
        ...formData,
        start_at: formData.start_at ? new Date(formData.start_at).toISOString() : null,
        end_at: formData.end_at ? new Date(formData.end_at).toISOString() : null,
        event_type_id: formData.event_type_id || null,
      };
      
      const body = booking
        ? { id: booking.id, ...submitData }
        : submitData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save booking');
      }

      onSave();
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70">
      {error && (
        <div className="md:col-span-2 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="invitee_name" className="block text-sm font-medium text-slate-700 mb-1">
          Invitee Name *
        </label>
        <input
          id="invitee_name"
          type="text"
          value={formData.invitee_name}
          onChange={(e) => setFormData({ ...formData, invitee_name: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          required
        />
      </div>

      <div>
        <label htmlFor="invitee_email" className="block text-sm font-medium text-slate-700 mb-1">
          Invitee Email
        </label>
        <input
          id="invitee_email"
          type="email"
          value={formData.invitee_email}
          onChange={(e) => setFormData({ ...formData, invitee_email: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div>
        <label htmlFor="invitee_phone" className="block text-sm font-medium text-slate-700 mb-1">
          Invitee Phone
        </label>
        <input
          id="invitee_phone"
          type="tel"
          value={formData.invitee_phone}
          onChange={(e) => setFormData({ ...formData, invitee_phone: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
          Status
        </label>
        <select
          id="status"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div>
        <label htmlFor="start_at" className="block text-sm font-medium text-slate-700 mb-1">
          Start Time *
        </label>
        <input
          id="start_at"
          type="datetime-local"
          value={formData.start_at}
          onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          required
        />
      </div>

      <div>
        <label htmlFor="end_at" className="block text-sm font-medium text-slate-700 mb-1">
          End Time
        </label>
        <input
          id="end_at"
          type="datetime-local"
          value={formData.end_at}
          onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div>
        <label htmlFor="event_type_id" className="block text-sm font-medium text-slate-700 mb-1">
          Event Type
        </label>
        <select
          id="event_type_id"
          value={formData.event_type_id}
          onChange={(e) => setFormData({ ...formData, event_type_id: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          disabled={loadingEventTypes}
        >
          <option value="">Select an event type (Optional)</option>
          {eventTypes.map((eventType) => (
            <option key={eventType.id} value={eventType.id}>
              {eventType.title}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2 flex justify-end gap-2 mt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 cursor-pointer rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium disabled:opacity-50"
        >
          {loading ? 'Saving...' : booking ? 'Update Booking' : 'Create Booking'}
        </button>
      </div>
    </form>
  );
};

export default BookingForm;

