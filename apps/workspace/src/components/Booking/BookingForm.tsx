"use client";

import React, { useState, useEffect } from 'react';
import type { Booking } from '@/src/types/booking';

interface EventType {
  id: string;
  title: string;
}

interface Department {
  id: string;
  name: string;
}

interface ServiceProvider {
  id: string;
  email: string;
  raw_user_meta_data?: {
    full_name?: string;
    name?: string;
  };
}

interface Service {
  id: string;
  name: string;
}

interface CustomField {
  id: string;
  label: string;
  field_type: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'url';
  required: boolean;
  placeholder?: string;
}

interface IntakeFormSettings {
  name: boolean;
  email: boolean;
  phone: boolean;
  services: {
    enabled: boolean;
    allowed_service_ids: string[];
  };
  additional_description: boolean;
  custom_fields: CustomField[];
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
    department_id: '',
    service_provider_id: '',
  });
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [intakeFormSettings, setIntakeFormSettings] = useState<IntakeFormSettings | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number | string[]>>({});
  const [additionalDescription, setAdditionalDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingServiceProviders, setLoadingServiceProviders] = useState(true);
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

    const fetchDepartments = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data, error } = await supabase
          .from('departments')
          .select('id, name')
          .order('name');

        if (!error && data) {
          setDepartments(data);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setLoadingDepartments(false);
      }
    };

    const fetchServiceProviders = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          return;
        }

        const response = await fetch('/api/team-members', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          console.log("Service Providers:", result);
          
          if (result.teamMembers) {
            const providers = result.teamMembers
              .filter((member: any) => member.role === 'service_provider')
              .map((member: any) => ({
                id: member.id,
                email: member.email,
                raw_user_meta_data: { name: member.name },
              }));
            setServiceProviders(providers);
          }
        }
      } catch (error) {
        console.error('Error fetching service providers:', error);
      } finally {
        setLoadingServiceProviders(false);
      }
    };

    const fetchServices = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          return;
        }

        const response = await fetch('/api/services', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setServices(result.services || []);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
      }
    };

    const fetchIntakeFormSettings = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          return;
        }

        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.settings?.intake_form) {
            setIntakeFormSettings({
              name: result.settings.intake_form.name ?? true,
              email: result.settings.intake_form.email ?? true,
              phone: result.settings.intake_form.phone ?? false,
              services: result.settings.intake_form.services ?? {
                enabled: false,
                allowed_service_ids: [],
              },
              additional_description: result.settings.intake_form.additional_description ?? false,
              custom_fields: result.settings.intake_form.custom_fields ?? [],
            });
          }
        }
      } catch (error) {
        console.error('Error fetching intake form settings:', error);
      }
    };

    fetchEventTypes();
    fetchDepartments();
    fetchServiceProviders();
    fetchServices();
    fetchIntakeFormSettings();
  }, []);

  // Convert UTC timestamp to local datetime-local format (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (booking) {
      const startDate = formatDateTimeLocal(booking.start_at);
      const endDate = formatDateTimeLocal(booking.end_at);
      setFormData({
        invitee_name: booking.invitee_name || '',
        invitee_email: booking.invitee_email || '',
        invitee_phone: booking.invitee_phone || '',
        start_at: startDate,
        end_at: endDate,
        status: booking.status || 'pending',
        event_type_id: booking.event_type_id || '',
        department_id: booking.department_id || '',
        service_provider_id: booking.service_provider_id || '',
      });

      // Load intake form data from metadata
      const intakeForm = booking.metadata?.intake_form as Record<string, unknown> | undefined;
      if (intakeForm) {
        // Load selected services
        if (Array.isArray(intakeForm.services)) {
          setSelectedServices(intakeForm.services as string[]);
        }

        // Load additional description (from intake_form or notes for backward compatibility)
        const notes = intakeForm.additional_description as string | undefined;
        const legacyNotes = booking.metadata?.notes as string | undefined;
        setAdditionalDescription(notes || legacyNotes || '');

        // Load custom field values
        const customValues: Record<string, string | number | string[]> = {};
        if (intakeFormSettings?.custom_fields) {
          intakeFormSettings.custom_fields.forEach(field => {
            const value = intakeForm[field.id];
            if (value !== undefined && value !== null) {
              customValues[field.id] = value as string | number | string[];
            }
          });
        }
        setCustomFieldValues(customValues);
      } else {
        // Reset if no intake form data
        setSelectedServices([]);
        setCustomFieldValues({});
        // Check for legacy notes
        const legacyNotes = booking.metadata?.notes as string | undefined;
        setAdditionalDescription(legacyNotes || '');
      }
    } else {
      // Reset for new booking
      setSelectedServices([]);
      setCustomFieldValues({});
      setAdditionalDescription('');
    }
  }, [booking, intakeFormSettings]);

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
        department_id: formData.department_id || null,
        service_provider_id: formData.service_provider_id || null,
      };

      // Build intake form data
      const intakeFormData: Record<string, unknown> = {};
      
      // Add services if enabled
      if (intakeFormSettings?.services?.enabled && selectedServices.length > 0) {
        intakeFormData.services = selectedServices;
      }

      // Add additional description if enabled or if settings not loaded (backward compatibility)
      if ((intakeFormSettings === null || intakeFormSettings.additional_description === true) && additionalDescription.trim()) {
        intakeFormData.additional_description = additionalDescription.trim();
      }

      // Add custom field values
      if (intakeFormSettings?.custom_fields) {
        intakeFormSettings.custom_fields.forEach(field => {
          const value = customFieldValues[field.id];
          if (value !== undefined && value !== null && value !== '') {
            intakeFormData[field.id] = value;
          }
        });
      }

      // Merge intake form data into metadata
      // Also preserve metadata.notes for backward compatibility with email templates
      const existingMetadata = booking?.metadata || {};
      const metadataPayload: Record<string, unknown> = { ...existingMetadata };
      
      // Preserve existing email templates that read `metadata.notes`
      // Save notes if additional_description is enabled or if settings not loaded (backward compatibility)
      if ((intakeFormSettings === null || intakeFormSettings.additional_description === true) && additionalDescription.trim()) {
        metadataPayload.notes = additionalDescription.trim();
      }

      if (Object.keys(intakeFormData).length > 0) {
        metadataPayload.intake_form = {
          ...(existingMetadata.intake_form as Record<string, unknown> || {}),
          ...intakeFormData,
        };
      }

      const updatedMetadata = metadataPayload;

      const body = booking
        ? { id: booking.id, ...submitData, metadata: updatedMetadata }
        : { ...submitData, metadata: updatedMetadata };

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

      {/* Show name field if enabled in settings, or if settings not loaded yet (backward compatibility) */}
      {(intakeFormSettings === null || intakeFormSettings.name !== false) && (
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
      )}

      {/* Show email field if enabled in settings, or if settings not loaded yet (backward compatibility) */}
      {(intakeFormSettings === null || intakeFormSettings.email !== false) && (
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
      )}

      {/* Show phone field if enabled in settings */}
      {intakeFormSettings?.phone === true && (
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
      )}

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

      <div>
        <label htmlFor="department_id" className="block text-sm font-medium text-slate-700 mb-1">
          Department (Optional)
        </label>
        <select
          id="department_id"
          value={formData.department_id}
          onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          disabled={loadingDepartments}
        >
          <option value="">Select</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="service_provider_id" className="block text-sm font-medium text-slate-700 mb-1">
          Service Provider (Optional)
        </label>
        <select
          id="service_provider_id"
          value={formData.service_provider_id}
          onChange={(e) => setFormData({ ...formData, service_provider_id: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          disabled={loadingServiceProviders}
        >
          <option value="">Select</option>
          {serviceProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.raw_user_meta_data?.full_name || provider.raw_user_meta_data?.name || provider.email}
            </option>
          ))}
        </select>
      </div>

      {/* Services Selection */}
      {intakeFormSettings?.services?.enabled && (
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Services {intakeFormSettings.services.allowed_service_ids.length > 0 && '(Select from allowed services)'}
          </label>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-300 bg-white min-h-[60px]">
            {services
              .filter(service => 
                intakeFormSettings.services.allowed_service_ids.length === 0 || 
                intakeFormSettings.services.allowed_service_ids.includes(service.id)
              )
              .map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedServices(selectedServices.filter(id => id !== service.id));
                      } else {
                        setSelectedServices([...selectedServices, service.id]);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white border border-indigo-700'
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50'
                    }`}
                  >
                    {isSelected ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    <span>{service.name}</span>
                  </button>
                );
              })}
            {services.filter(service => 
              intakeFormSettings.services.allowed_service_ids.length === 0 || 
              intakeFormSettings.services.allowed_service_ids.includes(service.id)
            ).length === 0 && (
              <p className="text-sm text-slate-500 italic">No services available</p>
            )}
          </div>
        </div>
      )}

      {/* Additional Description */}
      {/* Show if enabled in settings, or if settings not loaded yet (backward compatibility) */}
      {(intakeFormSettings === null || intakeFormSettings.additional_description === true) && (
        <div className="md:col-span-2">
          <label htmlFor="additional_description" className="block text-sm font-medium text-slate-700 mb-1">
            Additional Information
          </label>
          <textarea
            id="additional_description"
            value={additionalDescription}
            onChange={(e) => setAdditionalDescription(e.target.value)}
            placeholder="Enter any additional notes or information..."
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            rows={4}
          />
        </div>
      )}

      {/* Custom Fields */}
      {intakeFormSettings?.custom_fields && intakeFormSettings.custom_fields.length > 0 && (
        <>
          {intakeFormSettings.custom_fields.map((field) => {
            const value = customFieldValues[field.id] || '';
            const isRequired = field.required;

            return (
              <div key={field.id} className={field.field_type === 'textarea' ? 'md:col-span-2' : ''}>
                <label htmlFor={`custom_${field.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                  {field.label} {isRequired && <span className="text-red-500">*</span>}
                </label>
                {field.field_type === 'textarea' ? (
                  <textarea
                    id={`custom_${field.id}`}
                    value={String(value)}
                    onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required={isRequired}
                    rows={4}
                  />
                ) : (
                  <input
                    id={`custom_${field.id}`}
                    type={field.field_type === 'number' ? 'number' : field.field_type === 'email' ? 'email' : field.field_type === 'tel' ? 'tel' : field.field_type === 'url' ? 'url' : 'text'}
                    value={String(value)}
                    onChange={(e) => {
                      const newValue = field.field_type === 'number' 
                        ? (e.target.value === '' ? '' : Number(e.target.value))
                        : e.target.value;
                      setCustomFieldValues({ ...customFieldValues, [field.id]: newValue });
                    }}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required={isRequired}
                  />
                )}
              </div>
            );
          })}
        </>
      )}

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

