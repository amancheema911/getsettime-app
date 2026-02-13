"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Workspace } from '@app/db';

interface EventType {
  id: string;
  title: string;
  duration_minutes: number | null;
}

interface EmbedBookingFormProps {
  workspace: Workspace;
}

type DayName = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

interface BreakTime {
  id: string;
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakTime[];
}

interface AvailabilitySettings {
  timesheet?: Record<DayName, DaySchedule>;
  individual?: Record<string, boolean>;
}

interface Booking {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
}

interface Timeslot {
  time: string;
  disabled: boolean;
  reason?: string;
}

const EmbedBookingForm = ({ workspace }: EmbedBookingFormProps) => {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySettings | null>(null);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [days, setDays] = useState<Date[]>(() => 
    Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    })
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);

  // Helper function to parse time string (HH:mm) to minutes
  const parseTimeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to format minutes to display time
  const formatMinutesToDisplay = (minutes: number): string => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  };

  // Helper function to check if a time slot conflicts with breaks
  const isTimeSlotOnBreak = (slotStartMinutes: number, slotEndMinutes: number, breaks: BreakTime[]): boolean => {
    return breaks.some((breakTime) => {
      const breakStart = parseTimeToMinutes(breakTime.start);
      const breakEnd = parseTimeToMinutes(breakTime.end);
      return slotStartMinutes < breakEnd && slotEndMinutes > breakStart;
    });
  };

  // Helper function to check if a time slot conflicts with existing bookings
  const isTimeSlotBooked = (slotStart: Date, slotEnd: Date): boolean => {
    return existingBookings.some((booking) => {
      const bookingStart = new Date(booking.start_at);
      const bookingEnd = new Date(booking.end_at);
      // Check for overlap: slot starts before booking ends AND slot ends after booking starts
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
  };

  // Helper function to get day name from date
  const getDayName = (date: Date): DayName => {
    const dayNames: DayName[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return dayNames[date.getDay()];
  };

  // Helper function to create individual slot key (matches availability page format)
  const getIndividualSlotKey = (date: Date, hour: number): string => {
    const dateStr = date.toISOString().split('T')[0];
    return `${dateStr}-${hour}`;
  };

  // Helper function to check if a date is today (same day, month, year)
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Helper function to check if a time slot is in the past (only for today)
  const isTimeSlotInPast = (slotStart: Date, checkDate: Date): boolean => {
    if (!isToday(checkDate)) {
      return false; // Only check past times for today
    }
    const now = new Date();
    return slotStart < now;
  };

  const timeslots = useMemo(() => {
    if (!selectedType || !selectedDate) {
      return [];
    }

    const duration = selectedType.duration_minutes || 30;
    const dayName = getDayName(selectedDate);
    const slots: Timeslot[] = [];

    // Get availability settings for the selected day
    const daySchedule = availabilitySettings?.timesheet?.[dayName];
    
    // If no timesheet config or day is disabled, return empty slots
    if (!daySchedule || !daySchedule.enabled) {
      return [];
    }

    const startMinutes = parseTimeToMinutes(daySchedule.startTime);
    const endMinutes = parseTimeToMinutes(daySchedule.endTime);
    
    // Generate slots based on duration within available hours
    for (let slotStartMinutes = startMinutes; slotStartMinutes < endMinutes; slotStartMinutes += duration) {
      const slotEndMinutes = slotStartMinutes + duration;
      
      // Skip if slot extends beyond end time
      if (slotEndMinutes > endMinutes) {
        break;
      }

      // Check if slot is on a break
      if (isTimeSlotOnBreak(slotStartMinutes, slotEndMinutes, daySchedule.breaks || [])) {
        slots.push({
          time: formatMinutesToDisplay(slotStartMinutes),
          disabled: true,
          reason: 'break',
        });
        continue;
      }

      // Create date objects for conflict checking
      const slotStart = new Date(selectedDate);
      const slotHour = Math.floor(slotStartMinutes / 60);
      const slotMinute = slotStartMinutes % 60;
      slotStart.setHours(slotHour, slotMinute, 0, 0);
      
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Check for booking conflicts
      if (isTimeSlotBooked(slotStart, slotEnd)) {
        slots.push({
          time: formatMinutesToDisplay(slotStartMinutes),
          disabled: true,
          reason: 'booked',
        });
        continue;
      }

      // Check individual overrides
      const individualKey = getIndividualSlotKey(selectedDate, slotHour);
      const individualOverride = availabilitySettings?.individual?.[individualKey];
      
      if (individualOverride === false) {
        slots.push({
          time: formatMinutesToDisplay(slotStartMinutes),
          disabled: true,
          reason: 'unavailable',
        });
        continue;
      }

      // Check if slot is in the past (only for today)
      if (isTimeSlotInPast(slotStart, selectedDate)) {
        slots.push({
          time: formatMinutesToDisplay(slotStartMinutes),
          disabled: true,
          reason: 'past',
        });
        continue;
      }

      // Slot is available
      slots.push({
        time: formatMinutesToDisplay(slotStartMinutes),
        disabled: false,
      });
    }
    
    return slots;
  }, [selectedType, selectedDate, availabilitySettings, existingBookings]);

  const loadMoreDates = useCallback(() => {
    if (isLoadingMoreRef.current) return;
    
    isLoadingMoreRef.current = true;
    setDays((prevDays) => {
      const lastDate = prevDays[prevDays.length - 1];
      const newDates: Date[] = [];
      for (let i = 1; i <= 10; i++) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i);
        newDates.push(d);
      }
      return [...prevDays, ...newDates];
    });
    
    // Reset loading flag after a short delay
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 300);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || step !== 2) return;

    const checkAndLoadMore = () => {
      if (isLoadingMoreRef.current) return;
      
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const distanceFromEnd = scrollWidth - (scrollLeft + clientWidth);
      
      // Load more when within 200px of the end
      if (distanceFromEnd < 200) {
        loadMoreDates();
      }
    };

    // Check immediately in case we're already near the end
    checkAndLoadMore();

    container.addEventListener('scroll', checkAndLoadMore, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', checkAndLoadMore);
    };
  }, [step, loadMoreDates, days.length]);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const response = await fetch(
          `/api/embed/event-types?workspace_slug=${workspace.slug}`
        );

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
  }, [workspace.slug]);

  useEffect(() => {
    const fetchAvailabilitySettings = async () => {
      try {
        const response = await fetch(
          `/api/embed/settings?workspace_id=${workspace.id}`
        );

        if (response.ok) {
          const result = await response.json();
          const availability = result.settings?.availability || {};
          setAvailabilitySettings({
            timesheet: availability.timesheet,
            individual: availability.individual,
          });
        }
      } catch (error) {
        console.error('Error fetching availability settings:', error);
      }
    };

    fetchAvailabilitySettings();
  }, [workspace.id]);

  useEffect(() => {
    const fetchBookingsForDate = async () => {
      if (!selectedDate) {
        setExistingBookings([]);
        return;
      }

      setLoadingAvailability(true);
      try {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const response = await fetch(
          `/api/embed/bookings?workspace_id=${workspace.id}&date=${dateStr}`
        );

        if (response.ok) {
          const result = await response.json();
          setExistingBookings(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching bookings for date:', error);
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchBookingsForDate();
  }, [selectedDate, workspace.id]);

  useEffect(() => {
    if (confirmed) {
      const t = setTimeout(() => {
        setStep(1);
        setSelectedType(null);
        setSelectedDate(null);
        setSelectedTime('');
        setName('');
        setEmail('');
        setPhone('');
        setNotes('');
        setOtpCode('');
        setOtpSent(false);
        setOtpVerified(false);
        setConfirmed(false);
      }, 3700);
      return () => clearTimeout(t);
    }
  }, [confirmed]);

  useEffect(() => {
    // Reset selected time when event type changes
    if (selectedType) {
      setSelectedTime('');
    }
  }, [selectedType]);

  useEffect(() => {
    // Reset selected time when date changes or if current time becomes invalid
    if (selectedDate && selectedTime) {
      const isTimeValid = timeslots.some(
        (slot) => slot.time === selectedTime && !slot.disabled
      );
      if (!isTimeValid) {
        setSelectedTime('');
      }
    } else if (!selectedDate) {
      setSelectedTime('');
    }
  }, [selectedDate, timeslots, selectedTime]);

  const handleSendOTP = async () => {
    if (!phone.trim() && !email.trim()) {
      setError('Please provide either phone or email');
      return;
    }

    setSendingOtp(true);
    setError(null);

    try {
      const response = await fetch('/api/embed/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send OTP');
      }

      setOtpSent(true);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode.trim()) {
      setError('Please enter the OTP code');
      return;
    }

    setVerifyingOtp(true);
    setError(null);

    try {
      const response = await fetch('/api/embed/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone.trim() || null,
          email: email.trim() || null,
          code: otpCode.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid OTP code');
      }

      setOtpVerified(true);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Invalid OTP code');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedType || !selectedDate || !selectedTime || !name.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!otpVerified) {
      setError('Please verify your phone or email with OTP');
      return;
    }

    // Find the selected timeslot to check if it's disabled
    const selectedSlot = timeslots.find((slot) => slot.time === selectedTime);
    if (selectedSlot?.disabled) {
      setError('This time slot is not available. Please select another time.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse time and combine with date
      const [time, period] = selectedTime.split(' ');
      const [hours, minutes] = time.split(':');
      let hour24 = parseInt(hours, 10);
      if (period === 'PM' && hour24 !== 12) hour24 += 12;
      if (period === 'AM' && hour24 === 12) hour24 = 0;

      const startDate = new Date(selectedDate);
      startDate.setHours(hour24, parseInt(minutes, 10), 0, 0);

      // Final validation: ensure the selected time is not in the past
      const now = new Date();
      if (startDate < now) {
        setError('Cannot book a time slot in the past. Please select a future time.');
        setLoading(false);
        return;
      }

      // Calculate end date based on duration
      const endDate = new Date(startDate);
      const duration = selectedType.duration_minutes || 30;
      endDate.setMinutes(endDate.getMinutes() + duration);

      const response = await fetch('/api/embed/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspace.id,
          event_type_id: selectedType.id,
          invitee_name: name.trim(),
          invitee_email: email.trim() || null,
          invitee_phone: phone.trim() || null,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          status: 'pending',
          otp_code: otpCode.trim(),
          verified_identifier: phone.trim() || email.trim(),
          metadata: notes.trim() ? { notes: notes.trim() } : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      setConfirmed(true);
      setStep(5);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fmtDay = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-3xl shadow-2xl overflow-hidden bg-white relative">
        {/* Header */}
        <div
          className="px-6 py-6 bg-gradient-to-r from-[#E8F8F0] to-[#FFF2F0] z-10 relative"
          style={
            workspace.primary_color
              ? {
                  background: `linear-gradient(to right, ${workspace.primary_color}20, ${workspace.accent_color || workspace.primary_color}20)`,
                }
              : undefined
          }
        >
          <div className="flex flex-wrap items-center gap-4">
            {workspace.logo_url ? (
              <img
                src={workspace.logo_url}
                alt={workspace.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white"
                style={{
                  background: workspace.primary_color || '#2ECC71',
                }}
              >
                🌿
              </div>
            )}
            <div>
              <div className="text-sm text-gray-600">Schedule with</div>
              <div className="text-lg font-semibold">{workspace.name}</div>
            </div>
            <div className="ml-auto text-sm text-gray-500">
              Step {step} of 5
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 relative">
          <div className="flex items-center gap-3 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full ${
                  s <= step
                    ? workspace.primary_color
                      ? 'bg-current'
                      : 'bg-[#2ECC71]'
                    : 'bg-gray-200'
                }`}
                style={
                  s <= step && workspace.primary_color
                    ? { color: workspace.primary_color }
                    : undefined
                }
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="relative min-h-[280px]">
            {/* Step 1: Event Type Selection */}
            {step === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-sm text-gray-500 mb-2">
                  What would you like to book?
                </div>
                {loadingEventTypes ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading event types...
                  </div>
                ) : eventTypes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No event types available</p>
                    <p className="text-xs mt-2">
                      Please contact the workspace owner
                    </p>
                  </div>
                ) : (
                  eventTypes.map((t) => {
                    const duration = t.duration_minutes || 30;
                    const emoji =
                      duration <= 30 ? '💬' : duration <= 60 ? '🎯' : '👥';
                    const subtitle =
                      duration <= 30
                        ? 'Quick friendly catch-up'
                        : duration <= 60
                          ? 'Deep strategy session'
                          : 'Team or class booking';
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedType(t);
                          setStep(2);
                        }}
                        className="w-full text-left p-5 rounded-2xl shadow-sm hover:shadow-md bg-white flex items-center gap-4 transition"
                      >
                        <div className="text-2xl">{emoji}</div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {t.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {subtitle}
                          </div>
                        </div>
                        <div className="ml-auto text-sm text-gray-400">
                          Choose
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Step 2: Date & Time Selection */}
            {step === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-sm text-gray-500">Pick a day</div>
                <div ref={scrollContainerRef} className="flex gap-3 overflow-x-auto pb-3">
                  {days.map((d) => (
                    <button
                      key={d.toISOString()}
                      onClick={() => {
                        setSelectedDate(d);
                        setSelectedTime('');
                      }}
                      className={`flex-none min-w-[96px] p-3 rounded-xl transition ${
                        selectedDate?.toDateString() === d.toDateString()
                          ? 'text-white'
                          : 'bg-white border shadow-sm hover:shadow-md'
                      }`}
                      style={
                        selectedDate?.toDateString() === d.toDateString() &&
                        workspace.primary_color
                          ? { background: workspace.primary_color }
                          : selectedDate?.toDateString() === d.toDateString()
                            ? { background: '#2ECC71' }
                            : undefined
                      }
                    >
                      <div className="text-xs">
                        {d.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="font-medium text-sm">
                        {d.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="text-sm text-gray-500">Available times</div>
                {loadingAvailability ? (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Loading available times...
                  </div>
                ) : timeslots.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    {!selectedType 
                      ? 'Please select an event type first'
                      : !selectedDate
                      ? 'Please select a date first'
                      : 'No available time slots for this date'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {timeslots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => !slot.disabled && setSelectedTime(slot.time)}
                        disabled={!selectedDate || slot.disabled}
                        className={`p-3 rounded-xl transition ${
                          selectedTime === slot.time
                            ? 'text-white'
                            : slot.disabled
                            ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                            : 'bg-white border shadow-sm hover:shadow-md'
                        } ${!selectedDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                        style={
                          selectedTime === slot.time && workspace.accent_color && !slot.disabled
                            ? { background: workspace.accent_color }
                            : selectedTime === slot.time && !slot.disabled
                              ? { background: '#FF6B6B' }
                              : undefined
                        }
                        title={slot.disabled ? `Unavailable${slot.reason === 'booked' ? ' (already booked)' : slot.reason === 'break' ? ' (break time)' : slot.reason === 'past' ? ' (past time)' : ''}` : ''}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setStep(1);
                      setSelectedDate(null);
                      setSelectedTime('');
                    }}
                    className="px-4 py-2 rounded-xl border hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => setStep(3)}
                    className={`ml-auto px-6 py-2 rounded-xl text-white transition ${
                      !selectedDate || !selectedTime
                        ? 'bg-gray-300 cursor-not-allowed'
                        : ''
                    }`}
                    style={
                      !selectedDate || !selectedTime
                        ? undefined
                        : workspace.primary_color
                          ? { background: workspace.primary_color }
                          : { background: '#2ECC71' }
                    }
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Contact Information */}
            {step === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-sm text-gray-500">
                  Tell us how to reach you ✨
                </div>
                <div className="grid gap-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name *"
                    className="p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#2ECC71]"
                    required
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="Email"
                    className="p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#2ECC71]"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    placeholder="Phone"
                    className="p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#2ECC71]"
                  />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything we should know?"
                    className="p-3 rounded-xl border h-24 resize-none focus:outline-none focus:ring-2 focus:ring-[#2ECC71]"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl border hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    disabled={!name.trim() || (!email.trim() && !phone.trim())}
                    className={`ml-auto px-6 py-2 rounded-xl text-white transition ${
                      !name.trim() || (!email.trim() && !phone.trim())
                        ? 'bg-gray-300 cursor-not-allowed'
                        : ''
                    }`}
                    style={
                      !name.trim() || (!email.trim() && !phone.trim())
                        ? undefined
                        : workspace.primary_color
                          ? { background: workspace.primary_color }
                          : { background: '#2ECC71' }
                    }
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: OTP Verification */}
            {step === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-sm text-gray-500">
                  Verify your contact information
                </div>
                {!otpSent ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-xl text-sm text-gray-700">
                      We'll send a verification code to{' '}
                      {phone.trim() ? `your phone` : `your email`}
                    </div>
                    <button
                      onClick={handleSendOTP}
                      disabled={sendingOtp}
                      className={`w-full px-6 py-3 rounded-xl text-white transition ${
                        sendingOtp ? 'bg-gray-300 cursor-not-allowed' : ''
                      }`}
                      style={
                        sendingOtp
                          ? undefined
                          : workspace.primary_color
                            ? { background: workspace.primary_color }
                            : { background: '#2ECC71' }
                      }
                    >
                      {sendingOtp ? 'Sending...' : 'Send Verification Code'}
                    </button>
                  </div>
                ) : !otpVerified ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-xl text-sm text-gray-700">
                      Verification code sent! Please check{' '}
                      {phone.trim() ? `your phone` : `your email`}
                    </div>
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#2ECC71] text-center text-2xl tracking-widest"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode('');
                        }}
                        className="px-4 py-2 rounded-xl border hover:bg-gray-50 transition"
                      >
                        Change Contact
                      </button>
                      <button
                        onClick={handleVerifyOTP}
                        disabled={verifyingOtp || !otpCode.trim()}
                        className={`ml-auto px-6 py-2 rounded-xl text-white transition ${
                          verifyingOtp || !otpCode.trim()
                            ? 'bg-gray-300 cursor-not-allowed'
                            : ''
                        }`}
                        style={
                          verifyingOtp || !otpCode.trim()
                            ? undefined
                            : workspace.primary_color
                              ? { background: workspace.primary_color }
                              : { background: '#2ECC71' }
                        }
                      >
                        {verifyingOtp ? 'Verifying...' : 'Verify'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-100 rounded-xl text-sm text-green-700 flex items-center gap-2">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Verified successfully!
                    </div>
                    <button
                      onClick={handleConfirm}
                      disabled={loading}
                      className={`w-full px-6 py-3 rounded-xl text-white transition ${
                        loading ? 'bg-gray-300 cursor-not-allowed' : ''
                      }`}
                      style={
                        loading
                          ? undefined
                          : workspace.primary_color
                            ? { background: workspace.primary_color }
                            : { background: '#2ECC71' }
                      }
                    >
                      {loading ? 'Creating Booking...' : 'Confirm Booking'}
                    </button>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setStep(3);
                      setOtpSent(false);
                      setOtpVerified(false);
                      setOtpCode('');
                    }}
                    className="px-4 py-2 rounded-xl border hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Confirmation */}
            {step === 5 && (
              <div className="flex flex-col items-center justify-center py-6 animate-fadeIn">
                <div className="w-28 h-28 rounded-full flex items-center justify-center bg-gradient-to-tr from-[#E8F8F0] to-[#FFF2F0] mb-4 shadow-inner">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2ECC71"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div className="text-lg font-semibold text-gray-800">
                  You're all set — see you soon 👋
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  {selectedType?.title} •{' '}
                  {selectedDate ? fmtDay(selectedDate) : ''} • {selectedTime}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedBookingForm;

