"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { Booking } from '@/src/types/booking';
import type { Workspace } from '@app/db';

interface BookingListProps {
  workspaces: Workspace[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const BookingList = ({ workspaces }: BookingListProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'workspace'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const itemsPerPage = 10;

  // Debounce filter input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
      setCurrentPage(1); // Reset to first page when filter changes
    }, 500);

    return () => clearTimeout(timer);
  }, [filter]);

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
      });

      if (debouncedFilter) {
        params.append('filter', debouncedFilter);
      }

      const response = await fetch(`/api/bookings?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setBookings(data.bookings || []);
        setPagination(data.pagination || {
          page: currentPage,
          limit: itemsPerPage,
          total: 0,
          totalPages: 0,
        });
      } else {
        console.error('Error fetching bookings:', data.error);
        setBookings([]);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, debouncedFilter, itemsPerPage]);

  // Fetch bookings when dependencies change
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Get workspace name by ID
  const getWorkspaceName = (workspaceId: string | null): string => {
    if (!workspaceId) return 'N/A';
    const workspace = workspaces.find(w => String(w.id) === String(workspaceId));
    return workspace?.name || 'N/A';
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

  // Transform bookings for display
  const displayBookings = bookings.map((booking) => ({
    id: booking.id,
    name: booking.invitee_name || 'N/A',
    email: booking.invitee_email || 'N/A',
    workspace: getWorkspaceName(booking.workspace_id),
    workspaceId: booking.workspace_id,
    date: formatDate(booking.start_at),
    time: formatTime(booking.start_at),
    startAt: booking.start_at,
    type: booking.event_type_id || 'N/A',
    status: booking.status || 'Pending',
  }));

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top smoothly when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSort = (field: 'date' | 'name' | 'workspace') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: 'date' | 'name' | 'workspace') => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <section className="bg-white space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">All Bookings</h2>
      </div>

      <div className="w-full md:w-1/2">
        <input
          type="text"
          placeholder="Search by name, email, or workspace..."
          value={filter}
          onChange={handleFilterChange}
          className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Filter bookings"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
            <p className="text-lg">Loading bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No bookings found</p>
            {debouncedFilter && (
              <p className="text-sm">Try adjusting your search criteria</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                      disabled={loading}
                    >
                      Date {getSortIcon('date')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                      disabled={loading}
                    >
                      Name {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('workspace')}
                      className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                      disabled={loading}
                    >
                      Workspace {getSortIcon('workspace')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayBookings.map((displayBooking) => {
                  const status = displayBooking.status?.toLowerCase();
                  return (
                    <tr key={displayBooking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span className="text-slate-700">{displayBooking.date}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span className="font-medium text-slate-900">{displayBooking.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span className="text-sm text-slate-600">{displayBooking.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span className="text-sm text-slate-700">{displayBooking.workspace}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span className="text-slate-700">{displayBooking.time}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span className="text-sm text-slate-500">{displayBooking.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                            status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : status === 'reschedule'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {displayBooking.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex flex-col items-center gap-4 pt-4">
          <div className="text-sm text-slate-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} bookings
          </div>
          <div className="flex justify-center space-x-2">
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
                  }`}
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
        </div>
      )}
      {pagination.total > 0 && (
        <div className="text-center text-sm text-slate-500 pt-2">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} bookings
        </div>
      )}
    </section>
  );
};

export default BookingList;

