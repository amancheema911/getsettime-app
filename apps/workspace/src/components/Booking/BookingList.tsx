"use client";

import React, { useEffect, useState, useRef } from 'react';
import type { Booking } from '@/src/types/booking';
import BookingForm from './BookingForm';
import MultiStepBookingForm from './MultiStepBookingForm';

interface BookingListProps {
  bookings?: Booking[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface EventType {
  id: string;
  title: string;
}

interface ServiceProvider {
  id: string;
  email: string;
  raw_user_meta_data?: {
    full_name?: string;
    name?: string;
  };
}

interface TeamMember {
  id: string;
  email: string;
  name?: string;
  role?: string;
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

const BookingList = ({ bookings: initialBookings }: BookingListProps) => {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings || []);
  const [filter, setFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [intakeFormSettings, setIntakeFormSettings] = useState<IntakeFormSettings | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMultiStepForm, setShowMultiStepForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const itemsPerPage = 10;
  const isInitialMount = useRef(true);
  const filterChangingRef = useRef(false);

  const fetchBookings = async (page: number, search: string, date: string, status: string, eventTypeId: string) => {
    try {
      setLoading(true);
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      });

      if (search.trim()) {
        params.append('search', search.trim());
      }

      if (date.trim()) {
        params.append('date', date.trim());
      }

      if (status.trim()) {
        params.append('status', status.trim());
      }

      if (eventTypeId.trim()) {
        params.append('event_type_id', eventTypeId.trim());
      }

      const response = await fetch(`/api/bookings?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Bookings");
        console.log(result.data);
        setBookings(result.data || []);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch event types, services, and intake form settings on mount
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
          if (result.teamMembers) {
            const members: TeamMember[] = result.teamMembers;
            const providers = members
              .filter((member) => member.role === 'service_provider')
              .map((member) => ({
                id: member.id,
                email: member.email,
                raw_user_meta_data: { name: member.name, full_name: member.raw_user_meta_data?.full_name },
              }));
            setServiceProviders(providers);
          }
        }
      } catch (error) {
        console.error('Error fetching service providers:', error);
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
    fetchServiceProviders();
    fetchServices();
    fetchIntakeFormSettings();
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchBookings(1, '', '', '', '');
      return;
    }

    const debounceTimer = setTimeout(() => {
      filterChangingRef.current = true;
      setCurrentPage(1);
      fetchBookings(1, filter, dateFilter, statusFilter, eventTypeFilter);
      setTimeout(() => {
        filterChangingRef.current = false;
      }, 0);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filter, dateFilter, statusFilter, eventTypeFilter]);

  useEffect(() => {
    if (!isInitialMount.current && currentPage > 0 && !filterChangingRef.current) {
      fetchBookings(currentPage, filter, dateFilter, statusFilter, eventTypeFilter);
    }
  }, [currentPage]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) {
      return;
    }

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(`/api/bookings?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        await fetchBookings(currentPage, filter, dateFilter, statusFilter, eventTypeFilter);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete booking');
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('An error occurred while deleting the booking');
    }
  };

  const handleEdit = (booking: Booking) => {
    setEditingBooking(booking);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingBooking(null);
    setShowMultiStepForm(true);
  };

  const handleFormSave = async () => {
    setShowForm(false);
    setEditingBooking(null);
    await fetchBookings(currentPage, filter, dateFilter, statusFilter, eventTypeFilter);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setShowMultiStepForm(false);
    setEditingBooking(null);
  };

  const handleMultiStepFormSave = async () => {
    setShowMultiStepForm(false);
    await fetchBookings(currentPage, filter, dateFilter, statusFilter, eventTypeFilter);
  };

  const handleViewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  // Format date and time from timestamptz
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatTime = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };


  const getServiceProviderName = (serviceProviderId: string | null): string => {
    if (!serviceProviderId) return 'N/A';
    const provider = serviceProviders.find((sp) => sp.id === serviceProviderId);
    return provider?.raw_user_meta_data?.full_name || provider?.raw_user_meta_data?.name || provider?.email || 'N/A';
  };

  // Transform bookings for display
  const displayBookings = bookings.map((booking) => ({
    id: booking.id,
    name: booking.invitee_name || 'N/A',
    notes: booking.metadata?.['notes'] || 'N/A',
    date: formatDate(booking.start_at),
    time: formatTime(booking.start_at),
    type: booking.event_types?.title || 'N/A',
    status: booking.status || 'Pending',
    service_provider_name: getServiceProviderName(booking.service_provider_id),
  }));

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilter(e.target.value);
  };

  const handleClearDateFilter = () => {
    setDateFilter('');
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleEventTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEventTypeFilter(e.target.value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Bookings</h3>
          <p className="text-xs text-slate-500">View and manage all your scheduled appointments in one place.</p>
        </div>
        <button onClick={() => (showMultiStepForm) ? handleFormCancel() : handleCreate()} className="cursor-pointer text-sm font-bold text-indigo-600 transition">
          {(showMultiStepForm) ? "Cancel" : "+ New Booking"}
        </button>
      </header>

      {showMultiStepForm && (
        <div className="fixed inset-0 z-999 overflow-y-auto bg-gray-50 m-0 bg-opacity-50" onClick={handleFormCancel}>
          <div className="w-full mx-auto h-full relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleFormCancel} className="cursor-pointer fixed z-10 top-2 right-2 text-slate-500 hover:text-slate-700  rounded-full transition-colors" aria-label="Close modal">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <MultiStepBookingForm onSave={handleMultiStepFormSave} onCancel={handleFormCancel} />
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 mt-4">
        {/* First Row: Search and Date */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Filter */}
          <div className="w-full md:w-1/2">
            <label htmlFor="search-filter" className="block text-sm font-medium text-slate-700 mb-2">
              Search
            </label>
            <input
              id="search-filter"
              type="text"
              placeholder="Search bookings..."
              value={filter}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Filter bookings"
            />
          </div>

          {/* Date Filter */}
          <div className="w-full md:w-1/2">
            <label htmlFor="date-filter" className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Date
            </label>
            <div className="relative">
              {/* Calendar Icon */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              
              <input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={handleDateFilterChange}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Filter by date"
              />
              
              {/* Clear Button */}
              {dateFilter && (
                <button
                  onClick={handleClearDateFilter}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Clear date filter"
                  title="Clear date filter"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Second Row: Status and Event Type */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Status Filter */}
          <div className="w-full md:w-1/2">
            <label htmlFor="status-filter" className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
              <option value="reschedule">Reschedule</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="w-full md:w-1/2">
            <label htmlFor="event-type-filter" className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Event Type
            </label>
            <select
              id="event-type-filter"
              value={eventTypeFilter}
              onChange={handleEventTypeFilterChange}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Filter by event type"
            >
              <option value="">All Event Types</option>
              {eventTypes.map((eventType) => (
                <option key={eventType.id} value={eventType.id}>
                  {eventType.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Booking Form */}
      {showForm && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${ showForm ? 'pointer-events-auto opacity-100' :  'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${ showForm ? 'opacity-100' : 'opacity-0' }`} aria-hidden="true" onClick={handleFormCancel}/>
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${ showForm ? 'translate-x-0' : 'translate-x-full' }`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Edit Your Booking</h3>
                <p className="text-xs uppercase tracking-wide text-gray-500">Make changes to your scheduled Bookings anytime.</p>
              </div>
              <button className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close booking form" onClick={handleFormCancel}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
            <BookingForm
              booking={editingBooking}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
            </div>
          </section>
        </div>
      )}

      {/* Booking List */}
      <div className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No bookings found</p>
            <p className="text-sm">Click "New Booking" to create your first booking</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="border border-slate-200">
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Time</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Service Provider</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayBookings.map((displayBooking) => {
                  const actualBooking = bookings.find(b => b.id === displayBooking.id);
                  const status = displayBooking.status?.toLowerCase();
                  return (
                    <tr key={displayBooking.id} className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      {/* <td className="px-6 py-4 whitespace-nowrap align-middle text-sm text-slate-700" data-label="ID">
                        {displayBooking.id}
                      </td> */}
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Name">
                        <span className="font-medium text-slate-900">{displayBooking.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Date">
                        <span className="text-slate-700">{displayBooking.date}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Time">
                        <span className="text-slate-700">{displayBooking.time}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Type">
                        <span className="text-sm text-slate-500">{displayBooking.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Service Provider">
                    <span className="text-sm text-slate-500">{displayBooking.service_provider_name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Status">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${
                            status === 'confirmed'
                              ? 'bg-green-100 text-green-700'
                              : status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : status === 'reschedule'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {displayBooking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-middle" data-label="Action">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => actualBooking && handleViewBooking(actualBooking)} className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 inset-ring inset-ring-green-600/20 hover:bg-green-100 cursor-pointer">View</button>
                          <button onClick={() => actualBooking && handleEdit(actualBooking)} className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 inset-ring inset-ring-indigo-700/10 hover:bg-indigo-100 cursor-pointer">Edit</button>
                          <button onClick={() => handleDelete(displayBooking.id)} className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 inset-ring inset-ring-red-600/10 hover:bg-red-100 cursor-pointer">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination and showing total bookings */}
      <div className='flex justify-between items-center'>
        {/* Showing Totoal bookings */}
        {pagination.total > 0 && (
          <div className="text-center text-sm text-slate-500 pt-2">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} bookings
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center space-x-2 pt-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                currentPage === 1 || loading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              aria-label="Previous page"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, index) => {
              let pageNum: number;
              if (pagination.totalPages <= 10) {
                pageNum = index + 1;
              } else if (currentPage <= 5) {
                pageNum = index + 1;
              } else if (currentPage >= pagination.totalPages - 4) {
                pageNum = pagination.totalPages - 9 + index;
              } else {
                pageNum = currentPage - 5 + index;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    currentPage === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label={`Go to page ${pageNum}`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === pagination.totalPages || loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                currentPage === pagination.totalPages || loading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {isModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40" onClick={() => setIsModalOpen(false)}>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h3 className="text-xl font-semibold text-slate-800">Booking Details</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Close dialog"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Invitee Information */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Invitee Information</h4>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-slate-600 w-32">Name:</span>
                    <span className="text-slate-800">{selectedBooking.invitee_name || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-slate-600 w-32">Email:</span>
                    <span className="text-slate-800">{selectedBooking.invitee_email || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-slate-600 w-32">Phone:</span>
                    <span className="text-slate-800">{selectedBooking.invitee_phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Booking Details</h4>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-slate-600 w-32">Booking ID:</span>
                    <span className="text-slate-800">{selectedBooking.id}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-slate-600 w-32">Event Type:</span>
                    <span className="text-slate-800">{selectedBooking.event_types?.title || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-slate-600 w-32">Status:</span>
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-medium rounded-full w-fit ${
                        selectedBooking.status?.toLowerCase() === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : selectedBooking.status?.toLowerCase() === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : selectedBooking.status?.toLowerCase() === 'reschedule'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {selectedBooking.status || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Date & Time</h4>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-slate-600 w-32">Start Date:</span>
                    <span className="text-slate-800">{formatDate(selectedBooking.start_at)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="text-sm font-medium text-slate-600 w-32">Start Time:</span>
                    <span className="text-slate-800">{formatTime(selectedBooking.start_at)}</span>
                  </div>
                  {selectedBooking.end_at && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-sm font-medium text-slate-600 w-32">End Date:</span>
                        <span className="text-slate-800">{formatDate(selectedBooking.end_at)}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-sm font-medium text-slate-600 w-32">End Time:</span>
                        <span className="text-slate-800">{formatTime(selectedBooking.end_at)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Services */}
              {intakeFormSettings?.services?.enabled && (() => {
                const intakeForm = selectedBooking.metadata?.intake_form as Record<string, unknown> | undefined;
                const selectedServiceIds = (intakeForm?.services as string[]) || [];
                const selectedServiceNames = selectedServiceIds
                  .map(id => services.find(s => s.id === id)?.name)
                  .filter(Boolean) as string[];
                
                if (selectedServiceNames.length > 0) {
                  return (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Services</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedServiceNames.map((name, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 text-sm"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Custom Fields */}
              {intakeFormSettings?.custom_fields && intakeFormSettings.custom_fields.length > 0 && (() => {
                const intakeForm = selectedBooking.metadata?.intake_form as Record<string, unknown> | undefined;
                const customFieldValues = intakeForm || {};
                
                const fieldsToShow = intakeFormSettings.custom_fields.filter(field => {
                  const value = customFieldValues[field.id];
                  return value !== undefined && value !== null && value !== '';
                });

                if (fieldsToShow.length > 0) {
                  return (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Custom Fields</h4>
                      <div className="space-y-3">
                        {fieldsToShow.map((field) => {
                          const value = customFieldValues[field.id];
                          return (
                            <div key={field.id} className="flex flex-col sm:flex-row sm:items-center">
                              <span className="text-sm font-medium text-slate-600 w-32">{field.label}:</span>
                              <span className="text-slate-800">
                                {typeof value === 'string' || typeof value === 'number' 
                                  ? String(value) 
                                  : Array.isArray(value) 
                                    ? value.join(', ') 
                                    : 'N/A'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Additional Information */}
              {(intakeFormSettings?.additional_description === true || intakeFormSettings === null) && (() => {
                const intakeForm = selectedBooking.metadata?.intake_form as Record<string, unknown> | undefined;
                const notes = intakeForm?.additional_description as string | undefined;
                const legacyNotes = selectedBooking.metadata?.notes as string | undefined;
                const displayNotes = notes || legacyNotes;
                
                return (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Additional Information</h4>
                    <p className='text-slate-800 whitespace-pre-wrap'>{displayNotes || 'N/A'}</p>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}
    </section>
  );
};

export default BookingList;