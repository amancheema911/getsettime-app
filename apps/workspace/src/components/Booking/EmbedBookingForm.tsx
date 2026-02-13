"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Workspace } from '@app/db';
import type { IntakeCustomField, IntakeCustomFieldType, IntakeFormSettings } from '../../types/workspace';

interface EventType {
  id: string;
  title: string;
  duration_minutes: number | null;
}

interface Department {
  id: number;
  name: string;
  description: string | null;
}

interface ServiceProvider {
  id: string;
  name: string;
  email: string;
  departments: number[];
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

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
};

type IntakeValues = Record<string, string | string[]>;

const isNonEmptyString = (v: string) => v.trim().length > 0;

const isValidEmail = (email: string): boolean => {
  const v = email.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
};

const normalizePhone = (phone: string): string => phone.replace(/[^\d]/g, '');

const isValidPhone = (phone: string): boolean => {
  const digits = normalizePhone(phone);
  return digits.length >= 7;
};

const getCustomFieldType = (field: IntakeCustomField): IntakeCustomFieldType => {
  return (field.type || field.field_type || 'text') as IntakeCustomFieldType;
};

const isServicesEnabled = (settings: IntakeFormSettings | undefined): boolean => {
  const services = settings?.services;
  if (typeof services === 'boolean') return services;
  return Boolean(services?.enabled);
};

const getAllowedServiceIds = (settings: IntakeFormSettings | undefined): string[] => {
  const services = settings?.services;
  if (typeof services === 'boolean') return [];
  return services?.allowed_service_ids || [];
};

const EmbedBookingForm = ({ workspace }: EmbedBookingFormProps) => {
  const [step, setStep] = useState(1);
  
  // Department and service provider selection state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [intakeForm, setIntakeForm] = useState<IntakeFormSettings | undefined>(undefined);
  const [generalSettings, setGeneralSettings] = useState<{ primaryColor?: string; accentColor?: string } | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  
  // Sort event types by duration: 15min, 30min, 45min, then 60min+
  const sortedEventTypes = useMemo(() => {
    return [...eventTypes].sort((a, b) => {
      const durationA = a.duration_minutes || 0;
      const durationB = b.duration_minutes || 0;
      
      // Define the desired order: 15, 30, 45, 60+
      const order = [15, 30, 45, 60];
      
      // Get index in the order array, or -1 if not found
      const indexA = order.indexOf(durationA);
      const indexB = order.indexOf(durationB);
      
      // If both are in the predefined order, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only A is in the order, it comes first
      if (indexA !== -1) return -1;
      
      // If only B is in the order, it comes first
      if (indexB !== -1) return 1;
      
      // If neither is in the order, sort by duration (ascending)
      // But anything 60+ should come after 60
      if (durationA >= 60 && durationB >= 60) {
        return durationA - durationB;
      }
      if (durationA >= 60) return 1;
      if (durationB >= 60) return -1;
      
      // For durations not in the order and less than 60, sort ascending
      return durationA - durationB;
    });
  }, [eventTypes]);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySettings | null>(null);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [days, setDays] = useState<Date[]>(() => {
    // Helper to normalize dates in initializer
    const normalizeDateLocal = (date: Date): Date => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return normalizeDateLocal(d);
    });
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
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

  // Helper function to get day name from date
  const getDayName = (date: Date): DayName => {
    const dayNames: DayName[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return dayNames[date.getDay()];
  };

  // Helper function to format date as YYYY-MM-DD in LOCAL timezone (not UTC)
  // This ensures consistency between date strings and day-of-week calculations
  const formatLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to normalize a date to midnight in local timezone
  // This ensures consistent date handling regardless of how the date was created
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Helper function to create individual slot key (matches availability page format)
  const getIndividualSlotKey = (date: Date, hour: number): string => {
    const dateStr = formatLocalDateString(date);
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

  /**
   * Checks if two time ranges overlap (even partially)
   * Uses the standard range overlap formula: range1Start < range2End && range1End > range2Start
   * 
   * This correctly handles:
   * - Partial overlaps (e.g., 9:00-10:00 overlaps with 9:30-10:30)
   * - Complete overlaps (e.g., 9:00-10:00 overlaps with 9:15-9:45)
   * - Contained ranges (e.g., 9:00-10:00 overlaps with 8:30-10:30)
   * - Adjacent ranges are NOT overlapping (e.g., 9:00-9:15 and 9:15-9:30 are adjacent, not overlapping)
   */
  const doTimeRangesOverlap = (
    range1Start: Date,
    range1End: Date,
    range2Start: Date,
    range2End: Date
  ): boolean => {
    // Create copies to avoid mutating original dates
    const r1Start = new Date(range1Start.getTime());
    const r1End = new Date(range1End.getTime());
    const r2Start = new Date(range2Start.getTime());
    const r2End = new Date(range2End.getTime());
    
    // Standard overlap formula: ranges overlap if one starts before the other ends
    // AND one ends after the other starts
    // This is equivalent to: NOT (range1 ends before range2 starts OR range1 starts after range2 ends)
    return r1Start < r2End && r1End > r2Start;
  };

  /**
   * Checks if a time slot conflicts with any existing booking
   * 
   * Duration-Aware Conflict Detection:
   * - A slot is disabled ONLY if it overlaps in time with an existing booking
   * - Overlap is checked using time ranges, not start-time equality
   * - Timezone handling is automatic via Date object parsing
   * - This allows slots that don't overlap to remain available, even if they share a start time
   * 
   * Examples:
   * - Booking: 09:45-10:00 (15 min)
   *   - Slot 09:00-09:45 (45 min): NOT disabled (no overlap, adjacent is allowed)
   *   - Slot 09:15-10:00 (45 min): DISABLED (overlaps 09:45-10:00)
   *   - Slot 09:30-10:15 (45 min): DISABLED (overlaps 09:45-10:00)
   *   - Slot 10:00-10:45 (45 min): NOT disabled (no overlap, adjacent is allowed)
   * 
   * - Booking: 11:15-12:00 (45 min)
   *   - Slot 11:00-11:45 (45 min): DISABLED (overlaps 11:15-12:00)
   *   - Slot 11:15-12:00 (45 min): DISABLED (exact match)
   *   - Slot 12:00-12:45 (45 min): NOT disabled (no overlap, adjacent is allowed)
   */
  const isTimeSlotBooked = (slotStart: Date, slotEnd: Date, selectedDate: Date): boolean => {
    if (existingBookings.length === 0) {
      return false;
    }

    // Normalize the selected date to midnight for consistent comparison
    const normalizedSelectedDate = normalizeDate(selectedDate);

    return existingBookings.some((booking) => {
      // Parse booking times properly with timezone - Date constructor handles this automatically
      const bookingStart = new Date(booking.start_at);
      const bookingEnd = new Date(booking.end_at);
      
      // Normalize booking start date to check if it's on the same day
      const bookingDate = normalizeDate(bookingStart);
      
      // Check if booking is on the same day as the selected date
      if (bookingDate.toDateString() !== normalizedSelectedDate.toDateString()) {
        return false; // Booking is on a different day
      }
      
      // Check for time range overlap using the helper function
      // The Date objects handle timezone conversions automatically
      // Formula: slotStart < bookingEnd && slotEnd > bookingStart
      // This detects any overlap, including:
      // - Slot 09:45-10:30 overlaps with booking 09:45-10:00 (09:45 < 10:00 && 10:30 > 09:45 = true)
      // - Slot 09:00-09:45 does NOT overlap with booking 09:45-10:00 (09:00 < 10:00 && 09:45 > 09:45 = false, since 09:45 is not > 09:45)
      return doTimeRangesOverlap(slotStart, slotEnd, bookingStart, bookingEnd);
    });
  };

  // Helper function to get calendar days for a month
  const getCalendarDays = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: Date[] = [];
    
    // Add previous month's trailing days
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, daysInPrevMonth - i));
    }
    
    // Add current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Add next month's leading days to fill the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  // Helper function to navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  /**
   * Helper function to check if a date is available
   * 
   * COMPREHENSIVE VALIDATION - A date is available ONLY if:
   * 1. Availability settings are loaded (general + provider-specific)
   * 2. The weekday is enabled in the merged timesheet
   * 3. The date is not in the past (except today)
   * 4. At least one hour is available (not all hours explicitly disabled via individual overrides)
   * 5. CRITICAL: At least one valid time slot exists after filtering out:
   *    - Breaks
   *    - Existing bookings (time-range overlap)
   *    - Individual hour overrides
   *    - Past times (for today)
   * 
   * This ensures users can NEVER select a date that has no valid time slots.
   */
  const isDateAvailable = (date: Date): boolean => {
    // Check 0: Availability settings must be loaded
    if (!availabilitySettings || !availabilitySettings.timesheet) {
      return false;
    }
    
    // Check 1: Event type must be selected (we need duration to calculate slots)
    if (!selectedType) {
      return false;
    }
    
    const dayName = getDayName(date);
    const daySchedule = availabilitySettings.timesheet[dayName];
    
    // Check 2: Day must be enabled in timesheet
    if (!daySchedule || !daySchedule.enabled) {
      return false;
    }
    
    // Check 3: Date must not be in the past
    if (date < new Date() && !isToday(date)) {
      return false;
    }
    
    // Check 4: At least one hour must be available (not all hours explicitly disabled)
    // If individual overrides exist for this date, check if ALL hours are disabled
    if (availabilitySettings?.individual) {
      const normalizedDate = normalizeDate(date);
      const dateStrCheck = formatLocalDateString(normalizedDate);
      
      // Get the hours that would be available based on timesheet
      const startMinutes = parseTimeToMinutes(daySchedule.startTime);
      const endMinutes = parseTimeToMinutes(daySchedule.endTime);
      const startHour = Math.floor(startMinutes / 60);
      const endHour = Math.ceil(endMinutes / 60);
      
      // Check if ALL hours are explicitly disabled
      let allHoursDisabled = true;
      
      for (let hour = startHour; hour < endHour; hour++) {
        const individualKey = `${dateStrCheck}-${hour}`;
        const individualOverride = availabilitySettings.individual[individualKey];
        
        // If any hour is not explicitly disabled (undefined or true), continue checking
        if (individualOverride !== false) {
          allHoursDisabled = false;
          break;
        }
      }
      
      // If all hours are explicitly disabled, this date is not available
      if (allHoursDisabled) {
        return false;
      }
    }
    
    // Check 5: CRITICAL - At least one valid time slot must exist after all filtering
    // Generate candidate slots for this date and check if any are valid
    const duration = selectedType.duration_minutes || 30;
    const startMinutes = parseTimeToMinutes(daySchedule.startTime);
    const endMinutes = parseTimeToMinutes(daySchedule.endTime);
    const normalizedDate = normalizeDate(date);
    
    // Check each candidate slot
    for (let slotStartMinutes = startMinutes; slotStartMinutes < endMinutes; slotStartMinutes += duration) {
      const slotEndMinutes = slotStartMinutes + duration;
      
      // Skip if slot extends beyond end time
      if (slotEndMinutes > endMinutes) {
        break;
      }
      
      // Check if slot overlaps with any break
      if (isTimeSlotOnBreak(slotStartMinutes, slotEndMinutes, daySchedule.breaks || [])) {
        continue;
      }
      
      // Create date objects for this slot
      const slotHour = Math.floor(slotStartMinutes / 60);
      const slotMinute = slotStartMinutes % 60;
      
      const slotStart = new Date(normalizedDate);
      slotStart.setHours(slotHour, slotMinute, 0, 0);
      
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);
      
      // Check if slot is booked
      if (isTimeSlotBooked(slotStart, slotEnd, date)) {
        continue;
      }
      
      // Check individual availability overrides
      const slotEndHour = Math.floor(slotEndMinutes / 60);
      let isOverrideDisabled = false;
      
      for (let hour = slotHour; hour <= slotEndHour; hour++) {
        const individualKey = getIndividualSlotKey(normalizedDate, hour);
        const individualOverride = availabilitySettings?.individual?.[individualKey];
        
        if (individualOverride === false) {
          isOverrideDisabled = true;
          break;
        }
      }
      
      if (isOverrideDisabled) {
        continue;
      }
      
      // Check if slot is in the past (only for today)
      if (isTimeSlotInPast(slotStart, date)) {
        continue;
      }
      
      // Found at least one valid slot - date is available
      return true;
    }
    
    // No valid slots found - date is NOT available
    return false;
  };

  /**
   * Generates time slots for the selected date and event type.
   * 
   * DURATION-AWARE SLOT GENERATION:
   * - Slots are generated ONLY for the selected event duration
   * - Each duration (15/30/45/60 mins) has its own independent slot list
   * - Changing event duration recalculates slots from scratch
   * - No global blocking - availability is recalculated per duration
   * 
   * AVAILABILITY SETTINGS HIERARCHY:
   * 1. Timesheet Settings (Day-wise schedules):
   *    - Defined per weekday (Sun-Sat)
   *    - Contains: enabled flag, start/end times, breaks
   *    - Saved at: settings.availability.timesheet
   *    - Example: Mon 9:00-17:00 with break 12:00-13:00
   * 
   * 2. Individual Overrides (Date-specific hour toggles):
   *    - Hour-based toggles for specific dates
   *    - Format: "YYYY-MM-DD-HOUR" -> boolean
   *    - Saved at: settings.availability.individual
   *    - Example: "2025-12-22-9" = false (hour 9 disabled on Dec 22)
   *    - Overrides timesheet for that specific hour
   * 
   * VALIDATION PROCESS (8 steps):
   * 1. Check timesheet: Day must be enabled in weekly schedule
   * 2. Validate time window: Slot must fit within day's start/end times
   * 3. Check breaks: Slot must not overlap with configured breaks
   * 4. Check bookings: Slot must not overlap with existing bookings (timezone-aware)
   * 5. Check individual overrides: Date-specific hour toggles (if set, overrides timesheet)
   * 6. Check past times: Slots in the past (today only) are disabled
   * 7. All checks passed: Slot is available
   * 8. Filter: Only available slots are shown to user
   * 
   * Duration-Aware Overlap Detection:
   * - A slot is disabled ONLY if it overlaps in TIME with a booking/break
   * - Overlap formula: slotStart < rangeEnd && slotEnd > rangeStart
   * - This is NOT based on start-time equality - it's based on time-range overlap
   * 
   * Examples (for 45-min event with bookings 09:45-10:00 and 11:15-12:00):
   * - Slot 09:00-09:45: AVAILABLE (no overlap with 09:45-10:00, adjacent is allowed)
   * - Slot 09:15-10:00: DISABLED (overlaps with 09:45-10:00)
   * - Slot 09:30-10:15: DISABLED (overlaps with 09:45-10:00)
   * - Slot 10:00-10:45: AVAILABLE (no overlap, adjacent is allowed)
   * - Slot 11:00-11:45: DISABLED (overlaps with 11:15-12:00)
   * - Slot 11:15-12:00: DISABLED (exact match with booking)
   * - Slot 12:00-12:45: AVAILABLE (no overlap, adjacent is allowed)
   * 
   * Mixed-Duration Booking Support:
   * - Existing bookings can be 15, 30, 45, 60+ minutes
   * - Each booking is treated as an occupied time range
   * - Slots are validated against ALL bookings regardless of their duration
   * - No global blocking - each duration is calculated independently
   */
  const timeslots = useMemo(() => {
    if (!selectedType || !selectedDate) {
      return [];
    }

    const duration = selectedType.duration_minutes || 30;
    const dayName = getDayName(selectedDate);
    const slots: Timeslot[] = [];

    // Step 1: Get availability settings for the selected day
    const daySchedule = availabilitySettings?.timesheet?.[dayName];
    
    // If no timesheet config or day is disabled, return empty slots
    if (!daySchedule || !daySchedule.enabled) {
      return [];
    }

    // Step 2: Calculate available time window for the day
    const startMinutes = parseTimeToMinutes(daySchedule.startTime);
    const endMinutes = parseTimeToMinutes(daySchedule.endTime);
    
    // Step 3: Generate candidate slots based on selected duration
    // Slots are generated at fixed intervals (15, 30, 45, 60 mins) within the availability window
    for (let slotStartMinutes = startMinutes; slotStartMinutes < endMinutes; slotStartMinutes += duration) {
      const slotEndMinutes = slotStartMinutes + duration;
      
      // Skip if slot extends beyond end time
      if (slotEndMinutes > endMinutes) {
        break;
      }

      // Step 4: Check if slot overlaps with any break
      // Breaks are time periods when the service provider is unavailable
      if (isTimeSlotOnBreak(slotStartMinutes, slotEndMinutes, daySchedule.breaks || [])) {
        slots.push({
          time: formatMinutesToDisplay(slotStartMinutes),
          disabled: true,
          reason: 'break',
        });
        continue;
      }

      // Step 5: Create date objects for conflict checking
      // Normalize the selected date to midnight first, then set the slot time
      // This ensures consistent date handling regardless of selectedDate's time components
      const normalizedDate = normalizeDate(selectedDate);
      const slotHour = Math.floor(slotStartMinutes / 60);
      const slotMinute = slotStartMinutes % 60;
      
      const slotStart = new Date(normalizedDate);
      slotStart.setHours(slotHour, slotMinute, 0, 0);
      
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Step 6: Duration-aware booking conflict detection
      // CRITICAL: This checks for TIME RANGE OVERLAP, not start-time equality
      // A slot is disabled ONLY if it overlaps in time with an existing booking
      // 
      // Examples for 45-min event with booking 09:45-10:00 (15 min):
      // - Slot 09:00-09:45: NOT disabled (no overlap, adjacent is allowed)
      // - Slot 09:15-10:00: DISABLED (overlaps 09:45-10:00)
      // - Slot 09:30-10:15: DISABLED (overlaps 09:45-10:00)
      // - Slot 10:00-10:45: NOT disabled (no overlap, adjacent is allowed)
      //
      // Examples for 45-min event with booking 11:15-12:00 (45 min):
      // - Slot 11:00-11:45: DISABLED (overlaps 11:15-12:00)
      // - Slot 11:15-12:00: DISABLED (exact match)
      // - Slot 12:00-12:45: NOT disabled (no overlap, adjacent is allowed)
      //
      // This is duration-aware: each event duration has independent slot availability
      // Changing event duration recalculates slots from scratch - no global blocking
      if (isTimeSlotBooked(slotStart, slotEnd, selectedDate)) {
        slots.push({
          time: formatMinutesToDisplay(slotStartMinutes),
          disabled: true,
          reason: 'booked',
        });
        continue;
      }

      // Step 7: Check individual availability overrides (date-specific hour toggles)
      // Individual overrides are hour-based toggles set in the availability page
      // Format: "YYYY-MM-DD-HOUR" -> boolean (false = disabled, true = enabled, undefined = use timesheet)
      // 
      // Logic:
      // - If ANY hour the slot spans is explicitly disabled (false), disable the slot
      // - If a slot spans multiple hours, ALL hours must be available for the slot to be available
      // 
      // Example: Slot 9:30-10:15 spans hours 9 and 10
      // - If hour 9 is disabled: slot is disabled
      // - If hour 10 is disabled: slot is disabled
      // - If both are enabled/undefined: slot is available (assuming other checks pass)
      const slotEndHour = Math.floor(slotEndMinutes / 60);
      let isOverrideDisabled = false;
      
      // Check all hours the slot spans (in case it crosses hour boundaries)
      // Use normalizedDate for consistency with slot date creation
      for (let hour = slotHour; hour <= slotEndHour; hour++) {
        const individualKey = getIndividualSlotKey(normalizedDate, hour);
        const individualOverride = availabilitySettings?.individual?.[individualKey];
        
        // If this specific hour is explicitly disabled, the slot is unavailable
        // Note: undefined means "use timesheet default" (already validated above)
        if (individualOverride === false) {
          isOverrideDisabled = true;
          break;
        }
      }
      
      if (isOverrideDisabled) {
        slots.push({
          time: formatMinutesToDisplay(slotStartMinutes),
          disabled: true,
          reason: 'unavailable',
        });
        continue;
      }

      // Step 8: Check if slot is in the past (only for today)
      // Past time slots are not selectable for today's date
      if (isTimeSlotInPast(slotStart, selectedDate)) {
        slots.push({
          time: formatMinutesToDisplay(slotStartMinutes),
          disabled: true,
          reason: 'past',
        });
        continue;
      }

      // Step 9: Slot passed all checks - it's available
      slots.push({
        time: formatMinutesToDisplay(slotStartMinutes),
        disabled: false,
      });
    }
    
    // Return slots - disabled slots are filtered out in UI, only available slots are shown
    // This ensures duration-aware availability: each event duration has independent slot lists
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
        newDates.push(normalizeDate(d));
      }
      return [...prevDays, ...newDates];
    });
    
    // Reset loading flag after a short delay
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 300);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`/api/embed/settings?workspace_id=${workspace.id}`);
        if (!res.ok) return;
        const data: { settings?: { intake_form?: IntakeFormSettings; general?: { primaryColor?: string; accentColor?: string } } } = await res.json();
        setIntakeForm(data.settings?.intake_form);
        setGeneralSettings(data.settings?.general || null);
      } catch {
        // ignore
      }
    };

    fetchSettings();
  }, [workspace.id]);

  // Clear values for disabled built-in fields so they never end up in payload.
  useEffect(() => {
    if (!intakeForm) return;
    if (intakeForm.name === false) setName('');
    if (intakeForm.email === false) setEmail('');
    if (intakeForm.phone === false) setPhone('');
    if (intakeForm.additional_description === false) setNotes('');
  }, [intakeForm]);

  // Load services only if intake form enables them.
  useEffect(() => {
    if (!isServicesEnabled(intakeForm)) {
      setServices([]);
      setSelectedServiceIds([]);
      return;
    }

    const fetchServices = async () => {
      try {
        setLoadingServices(true);
        const res = await fetch(`/api/embed/services?workspace_id=${workspace.id}`);
        if (!res.ok) return;
        const data: { services?: Service[] } = await res.json();
        const all = data.services || [];
        const allowed = getAllowedServiceIds(intakeForm);
        const filtered = allowed.length > 0 ? all.filter((s) => allowed.includes(s.id)) : all;
        setServices(filtered);
        setSelectedServiceIds((prev) => prev.filter((id) => filtered.some((s) => s.id === id)));
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServices();
  }, [intakeForm, workspace.id]);

  const intakeValidation = useMemo(() => {
    const errors: Record<string, string> = {};

    const nameEnabled = intakeForm?.name !== false; // default true
    const emailEnabled = intakeForm?.email !== false; // default true
    const phoneEnabled = intakeForm?.phone === true; // default false
    const servicesEnabled = isServicesEnabled(intakeForm);

    if (nameEnabled && !isNonEmptyString(name)) {
      errors.name = 'Name is required';
    }

    if (emailEnabled) {
      if (!isNonEmptyString(email)) errors.email = 'Email is required';
      else if (!isValidEmail(email)) errors.email = 'Enter a valid email';
    }

    if (phoneEnabled) {
      if (!isNonEmptyString(phone)) errors.phone = 'Phone is required';
      else if (!isValidPhone(phone)) errors.phone = 'Enter a valid phone number';
    }

    if (servicesEnabled) {
      if (loadingServices) {
        errors.services = 'Loading services…';
      } else if (services.length === 0) {
        errors.services = 'No services available';
      } else if (selectedServiceIds.length === 0) {
        errors.services = 'Please select at least one service';
      }
    }

    const customFields = intakeForm?.custom_fields || [];
    for (const field of customFields) {
      const id = field.id;
      const label = field.label || id;
      const required = field.required === true;
      const value = (customFieldValues[id] || '').trim();
      const type = getCustomFieldType(field);

      if (required && !value) {
        errors[id] = `${label} is required`;
        continue;
      }

      if (value && type === 'number') {
        const n = Number(value);
        if (Number.isNaN(n)) errors[id] = `${label} must be a number`;
      }
    }

    if (intakeForm?.name === false && intakeForm?.email === false && intakeForm?.phone === false) {
      errors._config = 'Invalid intake form configuration (no identifier fields enabled)';
    }

    return errors;
  }, [customFieldValues, email, intakeForm, loadingServices, name, phone, selectedServiceIds.length, services.length]);

  const isStep4Valid = Object.keys(intakeValidation).length === 0;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || step !== 3) return;

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

  // Fetch departments and filter only those with service providers
  useEffect(() => {
    const fetchDepartmentsWithProviders = async () => {
      try {
        // Fetch both departments and team members in parallel
        const [departmentsResponse, teamMembersResponse] = await Promise.all([
          fetch(`/api/embed/departments?workspace_id=${workspace.id}`),
          fetch(`/api/embed/team-members?workspace_id=${workspace.id}`)
        ]);

        if (departmentsResponse.ok && teamMembersResponse.ok) {
          const departmentsResult = await departmentsResponse.json();
          const teamMembersResult = await teamMembersResponse.json();
          
          const allDepartments = departmentsResult.departments || [];
          const allServiceProviders = (teamMembersResult.teamMembers || []).filter(
            (member: any) => member.role === 'service_provider' && !member.deactivated
          );

          // Filter departments to only include those with at least one service provider
          const departmentsWithProviders = allDepartments.filter((dept: Department) => {
            return allServiceProviders.some((provider: any) => 
              provider.departments && provider.departments.includes(dept.id)
            );
          });

          setDepartments(departmentsWithProviders);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchDepartmentsWithProviders();
  }, [workspace.id]);

  // Auto-skip to step 2 if no departments exist
  useEffect(() => {
    if (!loadingDepartments && departments.length === 0 && step === 1) {
      setStep(2);
    }
  }, [loadingDepartments, departments.length, step]);

  // Fetch service providers when department is selected
  useEffect(() => {
    if (!selectedDepartment) {
      setServiceProviders([]);
      setSelectedProvider(null);
      setAvailabilitySettings(null);
      setExistingBookings([]);
      return;
    }

    const fetchServiceProviders = async () => {
      setLoadingProviders(true);
      try {
        const response = await fetch(
          `/api/embed/team-members?workspace_id=${workspace.id}`
        );

        if (response.ok) {
          const result = await response.json();
          const providers = (result.teamMembers || []).filter(
            (member: any) => 
              member.role === 'service_provider' && 
              !member.deactivated &&
              member.departments &&
              member.departments.includes(selectedDepartment.id)
          );
          setServiceProviders(providers);
        }
      } catch (error) {
        console.error('Error fetching service providers:', error);
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchServiceProviders();
  }, [selectedDepartment, workspace.id]);

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

  // Fetch availability settings for selected provider (or general settings if no departments)
  useEffect(() => {
    // Only skip if we have departments but no provider selected
    if (!selectedProvider && departments.length > 0) {
      setAvailabilitySettings(null);
      setExistingBookings([]);
      setSelectedDate(null);
      setSelectedTime('');
      setLoadingAvailability(false);
      return;
    }

    // Skip if departments are still loading (unless we know there are no departments)
    if (loadingDepartments && departments.length === 0) {
      return;
    }

    const fetchAvailabilitySettings = async () => {
      setLoadingAvailability(true);
      setAvailabilitySettings(null); // Clear previous settings
      setExistingBookings([]); // Clear previous bookings
      setSelectedDate(null); // Reset date selection
      setSelectedTime(''); // Reset time selection
      
      try {
        const response = await fetch(
          `/api/embed/settings?workspace_id=${workspace.id}`
        );

        if (response.ok) {
          const result = await response.json();
          const availability = result.settings?.availability || {};
          
          // Get general/workspace-wide availability as base
          const generalTimesheet = availability.timesheet;
          const generalIndividual = availability.individual;
          
          // Get provider-specific overrides (only if provider is selected)
          let finalTimesheet = generalTimesheet;
          let finalIndividual = generalIndividual || {};
          
          if (selectedProvider) {
            const providers = availability.providers || {};
            const providerOverrides = providers[selectedProvider.id] || {};
            
            // Merge: Start with general, overlay provider-specific changes
            finalTimesheet = generalTimesheet ? { ...generalTimesheet, ...(providerOverrides.timesheet || {}) } : providerOverrides.timesheet;
            finalIndividual = { ...(generalIndividual || {}), ...(providerOverrides.individual || {}) };
          }
          
          setAvailabilitySettings({
            timesheet: finalTimesheet,
            individual: finalIndividual,
          });
        }
      } catch (error) {
        console.error('Error fetching availability settings:', error);
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailabilitySettings();
  }, [selectedProvider, departments.length, loadingDepartments, workspace.id]);

  /**
   * Fetches all active bookings for the selected provider in the visible date range.
   * 
   * CRITICAL CHANGE: We now fetch bookings for ALL visible dates, not just the selected date.
   * This allows the date availability checker to properly disable dates with no valid slots.
   * 
   * This is critical for conflict resolution - we need ALL bookings (regardless of duration)
   * to properly check for overlaps when generating time slots and disabling dates.
   * 
   * Only active bookings (non-cancelled) are considered for conflict checking.
   * Bookings can have mixed durations (15, 30, 45, 60+ mins), and all are checked
   * against candidate time slots to ensure zero overlap.
   */
  useEffect(() => {
    const fetchBookingsForDateRange = async () => {
      // Require selectedType, and selectedProvider only if departments exist
      if (!selectedType || (departments.length > 0 && !selectedProvider)) {
        setExistingBookings([]);
        return;
      }

      setLoadingBookings(true);
      try {
        // Fetch bookings for a date range covering all visible dates
        // Use the days array to determine the range
        const startDate = days.length > 0 ? days[0] : new Date();
        const endDate = days.length > 0 ? days[days.length - 1] : new Date();
        
        // Add 30 days buffer to handle calendar view
        const rangeStart = new Date(startDate);
        rangeStart.setDate(rangeStart.getDate() - 5);
        
        const rangeEnd = new Date(endDate);
        rangeEnd.setDate(rangeEnd.getDate() + 35);
        
        // Format dates as YYYY-MM-DD
        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        const startDateStr = formatDate(rangeStart);
        const endDateStr = formatDate(rangeEnd);
        
        // Build API URL with or without provider filter
        const apiUrl = selectedProvider 
          ? `/api/embed/bookings?workspace_id=${workspace.id}&start_date=${startDateStr}&end_date=${endDateStr}&service_provider_id=${selectedProvider.id}`
          : `/api/embed/bookings?workspace_id=${workspace.id}&start_date=${startDateStr}&end_date=${endDateStr}`;
        
        const response = await fetch(apiUrl);

        if (response.ok) {
          const result = await response.json();
          
          // Filter out cancelled bookings and (if provider selected) bookings for other providers
          const activeBookings = (result.data || []).filter(
            (booking: Booking & {service_provider_id?: string}) => {
              if (booking.status === 'cancelled') return false;
              if (selectedProvider && booking.service_provider_id !== selectedProvider.id) return false;
              return true;
            }
          );
          setExistingBookings(activeBookings);
        }
      } catch (error) {
        console.error('Error fetching bookings for date range:', error);
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchBookingsForDateRange();
  }, [selectedProvider, selectedType, days, departments.length, workspace.id]);

  useEffect(() => {
    if (confirmed) {
      const t = setTimeout(() => {
        setStep(1);
        setSelectedDepartment(null);
        setSelectedProvider(null);
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
    // Reset selected date and time when event type changes
    // This is critical because different durations have different available slots
    if (selectedType) {
      setSelectedDate(null);
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

  useEffect(() => {
    // Reset calendar to current month when entering step 3 (date/time selection)
    if (step === 3 && !selectedDate) {
      setCurrentMonth(new Date());
    }
  }, [step, selectedDate]);

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
    if (!selectedType || !selectedDate || !selectedTime) {
      setError('Please fill in all required fields');
      return;
    }

    if (!isStep4Valid) {
      const firstError =
        intakeValidation._config ||
        intakeValidation.name ||
        intakeValidation.email ||
        intakeValidation.phone ||
        intakeValidation.services;
      setError(firstError || 'Please fill in all required fields');
      return;
    }

    if (!otpVerified) {
      setError('Please verify your phone or email with OTP');
      return;
    }

    // Only require provider and department if departments exist
    if (departments.length > 0) {
      if (!selectedProvider) {
        setError('Please select a service provider');
        return;
      }

      if (!selectedDepartment) {
        setError('Please select a department');
        return;
      }
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

      const nameEnabled = intakeForm?.name !== false; // default true
      const emailEnabled = intakeForm?.email !== false; // default true
      const phoneEnabled = intakeForm?.phone === true; // default false
      const servicesEnabled = isServicesEnabled(intakeForm);
      const additionalDescriptionEnabled = intakeForm?.additional_description === true; // default false

      const inviteeNameForBooking = nameEnabled
        ? name.trim()
        : (email.trim() || phone.trim() || 'Invitee');

      const intakeFormPayload: IntakeValues = {};
      if (nameEnabled) intakeFormPayload.name = name.trim();
      if (emailEnabled) intakeFormPayload.email = email.trim();
      if (phoneEnabled) intakeFormPayload.phone = phone.trim();
      if (servicesEnabled) intakeFormPayload.services = selectedServiceIds;
      if (additionalDescriptionEnabled && notes.trim()) intakeFormPayload.additional_description = notes.trim();

      const customFields = intakeForm?.custom_fields || [];
      for (const field of customFields) {
        const v = (customFieldValues[field.id] || '').trim();
        if (!v) continue;
        intakeFormPayload[field.id] = v;
      }

      const response = await fetch('/api/embed/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspace.id,
          event_type_id: selectedType.id,
          service_provider_id: selectedProvider?.id || null,
          department_id: selectedDepartment?.id || null,
          invitee_name: inviteeNameForBooking,
          invitee_email: emailEnabled ? (email.trim() || null) : null,
          invitee_phone: phoneEnabled ? (phone.trim() || null) : null,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          otp_code: otpCode.trim(),
          verified_identifier: phone.trim() || email.trim(),
          intake_form: Object.keys(intakeFormPayload).length > 0 ? intakeFormPayload : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      setConfirmed(true);
      setStep(6);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  // Helper function to format full date with timezone
  const formatDateWithTimezone = (date: Date): string => {
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString(undefined, dateOptions);
  };

  // Helper function to format time with timezone
  const formatTimeWithTimezone = (date: Date, timeString: string): string => {
    const [time, period] = timeString.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours, 10);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;

    const dateTime = new Date(date);
    dateTime.setHours(hour24, parseInt(minutes, 10), 0, 0);

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    };

    return dateTime.toLocaleString(undefined, timeOptions);
  };

  // Helper function to get icon based on duration
  const getServiceIcon = (duration: number) => {
    if (duration <= 30) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" fill="currentColor"/>
          <circle cx="9" cy="10" r="1" fill="white"/>
          <circle cx="15" cy="10" r="1" fill="white"/>
        </svg>
      );
    } else if (duration <= 60) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    } else {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M3 10h18" stroke="currentColor" strokeWidth="2"/>
          <path d="M8 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
      );
    }
  };

  // Helper function to get subtitle based on duration
  const getServiceSubtitle = (duration: number) => {
    if (duration <= 30) {
      return 'Fast friendly catch-up';
    } else if (duration <= 60) {
      return 'Deep planning & growth discussion';
    } else {
      return 'Full problem-solving session';
    }
  };

  const workspacePrimaryColor = generalSettings?.primaryColor || '#9333EA';
  const workspaceAccentColor = generalSettings?.accentColor || generalSettings?.primaryColor || '#3B82F6';
  const isExternalLogoUrl = workspace.logo_url?.startsWith('http://') || workspace.logo_url?.startsWith('https://');

  return (
    <div className="w-full max-w-7xl h-auto mx-auto px-6 sm:px-4 py-4 sm:py-6 lg:py-8">
      <div className="rounded-xl drop-shadow-xl overflow-hidden bg-gray-100 relative backdrop-blur-xl">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: `radial-gradient(circle, ${workspacePrimaryColor}, transparent)` }}/>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: `radial-gradient(circle, ${workspaceAccentColor}, transparent)` }}/>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 relative z-10">
          
          {/* Left Sidebar - Your Booking */}
          <div className="w-full lg:sticky lg:top-0 lg:overflow-y-auto bg-gradient-to-br p-4 sm:p-6 lg:p-8 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${workspacePrimaryColor || '#9333EA'}08 0%, ${workspaceAccentColor || workspacePrimaryColor || '#3B82F6'}08 100%)` }}>
            {/* Decorative Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${workspacePrimaryColor} 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
            </div>

            <div className="relative z-10">
              <div className="mb-4 sm:mb-4 lg:mb-6">
                <div className="inline-flex items-center gap-2 mb-2 sm:mb-3">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: workspacePrimaryColor }}/>
                  <span className="text-xs font-semibold uppercase tracking-wider">Live Preview</span>
                </div>
                <div className="py-2 z-10 relative">
                  <div className="flex flex-wrap items-center gap-4">
                    {workspace.logo_url ? (
                      isExternalLogoUrl ? (
                        <img src={workspace.logo_url} alt={workspace.name} className="w-12 h-12 rounded-xl object-contain" />
                      ) : (
                        <img src={workspace.logo_url} alt={workspace.name} className="w-12 h-12 rounded-xl object-cover" />
                      )
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white" style={{ background: workspacePrimaryColor }}>
                        🌿
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-600">Schedule with</div>
                      <div className="text-lg font-semibold">{workspace.name}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 group space-y-6">
                {!selectedDepartment && !selectedProvider && !selectedType ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
                    <div className="relative bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 border-2 border-dashed border-gray-200 text-center">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <p className="text-sm sm:text-base text-gray-400 font-medium">No selection yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {departments.length === 0 ? 'Start by selecting a service' : 'Start by selecting a department'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {selectedDepartment && !selectedProvider && (
                      <div className="details-box">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 text-base sm:text-lg mb-1 truncate">{selectedDepartment.name}</div>
                            <div className="text-xs sm:text-sm text-gray-600">Selected department</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedDepartment && selectedProvider && (
                      <div className="details-box">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 text-base sm:text-lg mb-1 truncate">{selectedDepartment.name}</div>
                            <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5 lowercase">
                              <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{selectedProvider.name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedType && (
                      <div className="details-box">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</div>
                        </div>
                        <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                          {selectedType.title}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 pl-9 sm:pl-11 flex items-center gap-1.5 mt-1">
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{selectedType.duration_minutes || 30} minutes</span>
                        </div>
                      </div>
                    )}

                    {selectedDate && (
                      <div className="details-box">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</div>
                        </div>
                        <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                          {formatDateWithTimezone(selectedDate)}
                        </div>
                      </div>
                    )}

                    {selectedTime && selectedDate && (
                      <div className="details-box">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</div>
                        </div>
                        <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                          {formatTimeWithTimezone(selectedDate, selectedTime)}
                        </div>
                      </div>
                    )}

                    {step === 4 && name && (
                      <div className="details-box">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</div>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 pl-9 sm:pl-11">
                          <div className="font-bold text-gray-900 text-sm sm:text-base truncate">{name}</div>
                          {email && <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 truncate">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate">{email}</span>
                          </div>}
                          {phone && <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 truncate">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="truncate">{phone}</span>
                          </div>}
                          {notes && <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 truncate">
                            <span className="truncate">{notes}</span>
                          </div>}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="p-4 sm:p-6 lg:p-8 xl:p-10 bg-white relative">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 lg:mb-10 relative flex-wrap">
              {[1, 2, 3, 4, 5, 6].map((s, index) => (
                <React.Fragment key={s}>
                  <div className="relative">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 relative z-10 ${
                        s === step
                          ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-xl scale-110 ring-2 sm:ring-4 ring-purple-200'
                          : s < step
                          ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                      }`}
                      style={
                        s === step || s < step
                          ? { background: s === step ? `linear-gradient(to bottom right, ${workspacePrimaryColor}, ${workspaceAccentColor})` : `linear-gradient(to bottom right, ${workspacePrimaryColor}dd, ${workspaceAccentColor}dd)` }
                          : undefined
                      }
                    >
                      {s < step ? (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        s
                      )}
                    </div>
                    {s === step && (
                      <div className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ background: workspacePrimaryColor }} />
                    )}
                  </div>
                  {index < 5 && (
                    <div
                      className={`h-1 w-6 sm:w-8 lg:w-12 rounded-full transition-all duration-500 hidden sm:block ${
                        s < step
                          ? 'bg-gradient-to-r'
                          : 'bg-gray-200'
                      }`}
                      style={
                        s < step
                          ? { background: `linear-gradient(to right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
                          : undefined
                      }
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="relative">
              {/* Step 1 - Department & Service Provider Selection */}
              {step === 1 && (
                <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                  <div className="text-center lg:text-left">
                    <h2 className="text-2xl font-bold text-gary-900">Select Department & Provider</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Choose the department and who you'd like to book with</p>
                  </div>
                  
                  {/* Department Selection */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">1. Choose Department</h3>
                    {loadingDepartments ? (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center gap-3 text-gray-500">
                          <div className="w-5 h-5 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
                          <span>Loading departments...</span>
                        </div>
                      </div>
                    ) : departments.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-600 font-medium text-sm">No departments available</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {departments.map((dept) => {
                          const isSelected = selectedDepartment?.id === dept.id;
                          return (
                            <button
                              key={dept.id}
                              onClick={() => {
                                setSelectedDepartment(dept);
                                setSelectedProvider(null); // Reset provider when department changes
                              }}
                              className={`group relative w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
                                isSelected
                                  ? 'border-indigo-400 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg'
                                  : 'border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/30'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                  {dept.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <div className="font-bold text-gray-900">{dept.name}</div>
                                  {dept.description && (
                                    <div className="text-xs text-gray-600 mt-0.5">{dept.description}</div>
                                  )}
                                </div>
                                {isSelected && (
                                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Service Provider Selection - Only show after department is selected */}
                  {selectedDepartment && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">2. Choose Provider</h3>
                      {loadingProviders ? (
                        <div className="text-center py-8">
                          <div className="inline-flex items-center gap-3 text-gray-500">
                            <div className="w-5 h-5 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
                            <span>Loading providers...</span>
                          </div>
                        </div>
                      ) : serviceProviders.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                          <p className="text-gray-600 font-medium text-sm">No providers available for this department</p>
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {serviceProviders.map((provider) => {
                            const isSelected = selectedProvider?.id === provider.id;
                            return (
                              <button
                                key={provider.id}
                                onClick={() => setSelectedProvider(provider)}
                                className={`group relative w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
                                  isSelected
                                    ? 'border-teal-400 bg-gradient-to-br from-white to-teal-50/30 shadow-lg'
                                    : 'border-gray-200 hover:border-teal-300 bg-white hover:bg-teal-50/30'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold">
                                    {provider.name.charAt(0)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-bold text-gray-900 capitalize">{provider.name}</div>
                                  </div>
                                  {isSelected && (
                                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Continue Button */}
                  {selectedDepartment && selectedProvider && (
                    <div className="flex justify-end pt-4">
                      <button
                        onClick={() => setStep(2)}
                        className="px-6 sm:px-10 py-3 sm:py-3.5 rounded-xl text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-semibold"
                      >
                        Continue to Services
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Event Type Selection */}
              {step === 2 && (
                <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                  <div className="text-center lg:text-left">
                    <h2 className="text-2xl font-bold text-gary-900">Choose a service</h2>
                    <p className="text-xs sm:text-sm text-gray-500">What would you like to book?</p>
                  </div>
                  {loadingEventTypes ? (
                    <div className="text-center py-16">
                      <div className="inline-flex items-center gap-3 text-gray-500">
                        <div className="w-6 h-6 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
                        <span>Loading event types...</span>
                      </div>
                    </div>
                  ) : eventTypes.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">No event types available</p>
                      <p className="text-sm text-gray-400 mt-2">Please contact the workspace owner</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {sortedEventTypes.map((t, index) => {
                        const duration = t.duration_minutes || 30;
                        const isSelected = selectedType?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => {setSelectedType(t); setStep(3);}}
                            className={`group relative w-full text-left p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border-2 flex items-center gap-3 sm:gap-4 lg:gap-5 transition-all duration-300 overflow-hidden ${
                              isSelected
                                ? 'border-purple-400 bg-gradient-to-br from-white to-purple-50/30 shadow-2xl scale-[1.02]'
                                : 'border-gray-200 hover:border-purple-400 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/30 hover:shadow-2xl hover:scale-[1.02]'
                            }`}
                            style={{ animationDelay: `${index * 100}ms` }}
                          >
                            {/* Hover Effect Background */}
                            <div className={`absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/5 to-purple-600/0 transition-opacity duration-500 ${
                              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`} />
                            
                            <div 
                              className={`relative z-10 w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white flex-shrink-0 transition-all duration-300 shadow-lg ${
                                isSelected ? 'scale-110 rotate-3' : 'group-hover:scale-110 group-hover:rotate-3'
                              }`}
                              style={{ background: workspacePrimaryColor }}
                            >
                              {getServiceIcon(duration)}
                            </div>
                            <div className="flex-1 relative z-10 min-w-0">
                              <div className={`font-bold text-base sm:text-lg lg:text-xl mb-1 sm:mb-2 transition-colors truncate ${
                                isSelected ? 'text-purple-700' : 'text-gray-900 group-hover:text-purple-700'
                              }`}>
                                {t.title}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600 line-clamp-2">{getServiceSubtitle(duration)}</div>
                            </div>
                            <div className={`relative z-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl transition-colors flex-shrink-0 ${
                              isSelected ? 'bg-blue-100' : 'bg-blue-50 group-hover:bg-blue-100'
                            }`}>
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#3B82F6' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-xs sm:text-sm font-bold whitespace-nowrap" style={{ color: '#3B82F6' }}>
                                {duration} min
                              </span>
                            </div>
                            <div className={`relative z-10 transition-opacity hidden sm:block ${
                              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}

              {/* Step 3: Date & Time Selection */}
              {step === 3 && (
                <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fadeIn">
                  <div className="text-center lg:text-left">
                    <h2 className="text-2xl font-bold text-gary-900">Pick a date & time</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Select when you'd like to meet</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">Pick a day</div>
                      </div>
                      <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="text-xs sm:text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                      >
                        {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
                        <svg className={`w-4 h-4 transition-transform ${showCalendar ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Calendar View */}
                    {showCalendar ? (
                      <div className="bg-white rounded-xl sm:rounded-2xl border-2 border-gray-200 p-4 sm:p-6 mb-4 shadow-lg">
                        
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={() => navigateMonth('prev')}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                          >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <h3 className="text-base sm:text-lg font-bold text-gray-900">
                            {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                          </h3>
                          <button
                            onClick={() => navigateMonth('next')}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                          >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2">
                          {/* Day Headers */}
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="text-center text-xs sm:text-sm font-bold text-gray-500 py-2">
                              {day}
                            </div>
                          ))}

                          {/* Calendar Days */}
                          {getCalendarDays(currentMonth).map((date, index) => {
                            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                            const isSelected = selectedDate?.toDateString() === date.toDateString();
                            const isTodayDate = isToday(date);
                            const isAvailable = isDateAvailable(date);
                            const isPast = date < new Date() && !isTodayDate;
                            const isDisabled = !isAvailable || isPast;

                            return (
                              <button
                                key={index}
                                onClick={() => {
                                  if (!isDisabled && isCurrentMonth) {
                                    // Normalize date to ensure consistent handling
                                    const normalizedDate = normalizeDate(date);
                                    setSelectedDate(normalizedDate);
                                    setSelectedTime('');
                                    // Navigate to the selected date's month if it's in a different month
                                    if (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear()) {
                                      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                                    }
                                    // Hide calendar after date selection
                                    setShowCalendar(false);
                                    // Update days array to include the selected date if it's not already there
                                    setDays((prevDays) => {
                                      const dateStr = normalizedDate.toDateString();
                                      const exists = prevDays.some(d => d.toDateString() === dateStr);
                                      if (!exists) {
                                        // Add dates around the selected date
                                        const newDays: Date[] = [];
                                        for (let i = -5; i <= 5; i++) {
                                          const newDate = new Date(normalizedDate);
                                          newDate.setDate(normalizedDate.getDate() + i);
                                          newDays.push(normalizeDate(newDate));
                                        }
                                        return newDays.sort((a, b) => a.getTime() - b.getTime());
                                      }
                                      return prevDays;
                                    });
                                  }
                                }}
                                disabled={isDisabled || !isCurrentMonth}
                                className={`
                                  aspect-square p-1 sm:p-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200
                                  ${!isCurrentMonth 
                                    ? 'text-gray-300 cursor-not-allowed' 
                                    : isDisabled
                                    ? 'bg-gray-50 border-2 border-gray-200 text-gray-300 cursor-not-allowed opacity-60'
                                    : isSelected
                                    ? 'bg-gradient-to-br text-white shadow-lg scale-110 ring-2 ring-purple-200'
                                    : 'text-gray-900 bg-white hover:bg-purple-50 hover:border-2 hover:border-purple-300 border-2 border-transparent'
                                  }
                                  ${isTodayDate && !isSelected && !isDisabled ? 'ring-2 ring-purple-400' : ''}
                                `}
                                style={
                                  isSelected && isCurrentMonth && !isDisabled
                                    ? { background: `linear-gradient(to bottom right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
                                    : undefined
                                }
                              >
                                <div className="flex flex-col items-center justify-center h-full">
                                  <span>{date.getDate()}</span>
                                  {isTodayDate && !isSelected && !isDisabled && (
                                    <div className="w-1 h-1 rounded-full bg-purple-600 mt-0.5" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                      </div>
                    ) : (
                      /* Quick Date Picker (Horizontal Scroll) - Filter out unavailable dates from slider */
                      <div ref={scrollContainerRef} className="flex gap-2 sm:gap-3 overflow-x-auto py-2 sm:pb-3 -mx-1 px-1 scroll-smooth">
                        {days
                          .filter((d) => {
                            // Only show dates that are available (enabled in timesheet and not in the past)
                            const isAvailable = isDateAvailable(d);
                            const isPast = d < new Date() && !isToday(d);
                            return isAvailable && !isPast;
                          })
                          .map((d) => {
                            const isSelected = selectedDate?.toDateString() === d.toDateString();
                            const isTodayDate = isToday(d);
                            // These dates are already filtered to be available, so they're never disabled
                            const isDisabled = false;

                            return (
                              <button
                                key={d.toISOString()}
                                onClick={() => {
                                  // Normalize date to ensure consistent handling
                                  const normalizedDate = normalizeDate(d);
                                  setSelectedDate(normalizedDate);
                                  setSelectedTime('');
                                }}
                                disabled={false}
                                className={`group flex-none min-w-[70px] p-2 rounded-xl sm:rounded-2xl transition-all duration-300 relative overflow-hidden ${
                                  isDisabled
                                    ? 'bg-gray-50 border-2 border-gray-200 text-gray-300 cursor-not-allowed opacity-60'
                                    : isSelected
                                    ? 'bg-gradient-to-br text-white shadow-xl scale-105 ring-2 sm:ring-4 ring-purple-200 z-10'
                                    : 'bg-white border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg hover:scale-105'
                                }`}
                                style={
                                  isSelected && !isDisabled
                                    ? { background: `linear-gradient(to bottom right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
                                    : undefined
                                }
                              >
                                {isSelected && !isDisabled && (
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                                )}
                                <div className="relative z-10 text-center">
                                  <div className={`text-[10px] sm:text-xs font-bold ${
                                    isDisabled
                                      ? 'text-gray-300'
                                      : isSelected
                                      ? 'text-purple-100'
                                      : 'text-gray-500'
                                  }`}>
                                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                                  </div>
                                  <div className={`font-bold text-base sm:text-lg lg:text-xl ${
                                    isDisabled
                                      ? 'text-gray-300'
                                      : isSelected
                                      ? 'text-white'
                                      : 'text-gray-900'
                                  }`}>
                                    {d.toLocaleDateString(undefined, { day: 'numeric' })}
                                  </div>
                                  <div className={`text-[10px] sm:text-xs ${
                                    isDisabled
                                      ? 'text-gray-300'
                                      : isSelected
                                      ? 'text-purple-100'
                                      : 'text-gray-500'
                                  }`}>
                                    {d.toLocaleDateString(undefined, { month: 'short' })}
                                  </div>
                                  {isTodayDate && !isSelected && !isDisabled && (
                                    <div className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ background: workspacePrimaryColor }} />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3 sm:mb-4">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">
                        Available times
                        <span className="text-xs text-gray-500 ml-2 normal-case font-normal">
                          ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                        </span>
                      </div>
                    </div>
                    {loadingAvailability ? (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center gap-3 text-gray-500">
                          <div className="w-6 h-6 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
                          <span>Loading available times...</span>
                        </div>
                      </div>
                  ) : loadingBookings ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center gap-3 text-gray-500">
                        <div className="w-6 h-6 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
                        <span>Loading available times...</span>
                      </div>
                    </div>
                  ) : timeslots.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium">
                          {!selectedType 
                            ? 'Please select an event type first'
                            : !selectedDate
                            ? 'Please select a date first'
                            : 'No available time slots for this date'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                        {timeslots
                          .filter((slot) => !slot.disabled)
                          .map((slot) => {
                            const isSelected = selectedTime === slot.time;
                            return (
                              <button
                                key={slot.time}
                                onClick={() => setSelectedTime(slot.time)}
                                disabled={!selectedDate}
                                className={`group relative p-2.5 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl transition-all duration-300 text-xs sm:text-sm font-bold overflow-hidden ${
                                  isSelected
                                    ? 'bg-gradient-to-br text-white shadow-xl scale-105 ring-2 sm:ring-4 ring-purple-200'
                                    : 'bg-white border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg hover:scale-105 hover:bg-purple-50'
                                } ${!selectedDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                                style={
                                  isSelected
                                    ? { background: `linear-gradient(to bottom right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
                                    : undefined
                                }
                              >
                                {isSelected && (
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                                )}
                                <span className="relative z-10">{slot.time}</span>
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 lg:mt-10 pt-6 sm:pt-8 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setStep(2);
                        setSelectedDate(null);
                        setSelectedTime('');
                      }}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-gray-700 hover:shadow-md"
                    >
                      Back
                    </button>
                    <button
                      disabled={!selectedDate || !selectedTime}
                      onClick={() => setStep(4)}
                      className={`w-full sm:w-auto sm:ml-auto px-6 sm:px-10 py-3 sm:py-3.5 rounded-xl text-white transition-all font-semibold ${
                        !selectedDate || !selectedTime
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-gradient-to-r shadow-xl hover:shadow-2xl hover:scale-105'
                      }`}
                      style={
                        !selectedDate || !selectedTime
                          ? undefined
                          : { background: `linear-gradient(to right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
                      }
                    >
                      Continue
                    </button>
                  </div>

                </div>
              )}

              {/* Step 4: Intake Form */}
              {step === 4 && (
                <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fadeIn">
                  <div className="text-center lg:text-left">
                    <h2 className="text-2xl font-bold text-gary-900">Your details</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Tell us how to reach you ✨</p>
                  </div>
                  
                  <div className="grid gap-6">
                    {intakeForm?.name !== false && (
                      <div className="group">
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500 transition-all bg-white hover:border-gray-300"
                            required
                          />
                        </div>
                      </div>
                    )}
                    {intakeForm?.email !== false && (
                      <div className="group">
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            placeholder="your.email@example.com"
                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500 transition-all bg-white hover:border-gray-300"
                            required
                          />
                        </div>
                      </div>
                    )}
                    {intakeForm?.phone === true && (
                      <div className="group">
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500 transition-all bg-white hover:border-gray-300"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {isServicesEnabled(intakeForm) && (
                      <div className="group">
                        <div className="text-sm font-semibold text-gray-700">Services</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {loadingServices ? (
                            <div className="text-sm text-gray-500">Loading services…</div>
                          ) : services.length === 0 ? (
                            <div className="text-sm text-gray-500">No services available</div>
                          ) : (
                            services.map((s) => {
                              const selected = selectedServiceIds.includes(s.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedServiceIds((prev) =>
                                      prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                                    );
                                  }}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all text-sm font-semibold ${
                                    selected
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-lg'
                                      : 'bg-white text-gray-700 border-gray-200 hover:border-purple-400 hover:bg-purple-50'
                                  }`}
                                  style={
                                    selected
                                      ? { background: workspacePrimaryColor, borderColor: workspacePrimaryColor }
                                      : undefined
                                  }
                                >
                                  <span className="truncate max-w-[220px]">{s.name}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {(intakeForm?.custom_fields || []).map((field) => {
                      const type = getCustomFieldType(field);
                      const value = customFieldValues[field.id] || '';
                      const required = field.required === true;
                      const placeholder = field.placeholder || '';
                      const baseClass = "w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500 transition-all bg-white hover:border-gray-300";

                      if (type === 'textarea') {
                        return (
                          <div key={field.id} className="group">
                            <div className="text-sm font-semibold text-gray-700">
                              {field.label}{required ? <span className="text-red-500"> *</span> : null}
                            </div>
                            <textarea
                              value={value}
                              onChange={(e) =>
                                setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                              }
                              placeholder={placeholder}
                              className={`${baseClass} h-36 resize-none mt-2`}
                              required={required}
                            />
                          </div>
                        );
                      }

                      if (type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
                        return (
                          <div key={field.id} className="group">
                            <div className="text-sm font-semibold text-gray-700">
                              {field.label}{required ? <span className="text-red-500"> *</span> : null}
                            </div>
                            <select
                              value={value}
                              onChange={(e) =>
                                setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                              }
                              className={`${baseClass} mt-2`}
                              required={required}
                            >
                              <option value="">{placeholder || 'Select an option'}</option>
                              {field.options.map((opt) => {
                                const o = typeof opt === 'string' ? { label: opt, value: opt } : opt;
                                return (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        );
                      }

                      const inputType: React.HTMLInputTypeAttribute =
                        type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';

                      return (
                        <div key={field.id} className="group">
                          <div className="text-sm font-semibold text-gray-700">
                            {field.label}{required ? <span className="text-red-500"> *</span> : null}
                          </div>
                          <input
                            value={value}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                            }
                            type={inputType}
                            placeholder={placeholder}
                            className={`${baseClass} mt-2`}
                            required={required}
                          />
                        </div>
                      );
                    })}

                    {intakeForm?.additional_description === true && (
                      <div className="group">
                        <div className="relative">
                          <div className="absolute left-4 top-4 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </div>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Anything we should know?"
                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 h-36 resize-none focus:outline-none focus:border-purple-500 transition-all bg-white hover:border-gray-300"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 lg:mt-10 pt-6 sm:pt-8 border-t border-gray-200">
                    <button
                      onClick={() => setStep(3)}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-gray-700 hover:shadow-md"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(5)}
                      disabled={!isStep4Valid}
                      className={`w-full sm:w-auto sm:ml-auto px-6 sm:px-10 py-3 sm:py-3.5 rounded-xl text-white transition-all font-semibold ${
                        !isStep4Valid
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-gradient-to-r shadow-xl hover:shadow-2xl hover:scale-105'
                      }`}
                      style={
                        !isStep4Valid
                          ? undefined
                          : { background: `linear-gradient(to right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
                      }
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: OTP Verification */}
              {/* Step 5: OTP Verification */}
              {step === 5 && (
                <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                  <div className="text-center lg:text-left">
                    <h2 className="text-2xl font-bold text-gray-900">Verify your contact</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Verify your contact information</p>
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
                          sendingOtp ? 'bg-gray-300 cursor-not-allowed' : 'shadow-xl hover:shadow-2xl hover:scale-105'
                        }`}
                        style={
                          sendingOtp
                            ? undefined
                            : { background: `linear-gradient(to right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
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
                        className="w-full p-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500 text-center text-2xl tracking-widest"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setOtpSent(false);
                            setOtpCode('');
                          }}
                          className="px-4 py-2 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-gray-700"
                        >
                          Change Contact
                        </button>
                        <button
                          onClick={handleVerifyOTP}
                          disabled={verifyingOtp || !otpCode.trim()}
                          className={`ml-auto px-6 py-2 rounded-xl text-white transition-all font-semibold ${
                            verifyingOtp || !otpCode.trim()
                              ? 'bg-gray-300 cursor-not-allowed'
                              : 'shadow-xl hover:shadow-2xl hover:scale-105'
                          }`}
                          style={
                            verifyingOtp || !otpCode.trim()
                              ? undefined
                              : { background: `linear-gradient(to right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
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
                        className={`w-full px-6 py-3 rounded-xl text-white transition-all font-semibold flex items-center justify-center gap-2 ${
                          loading ? 'bg-gray-300 cursor-not-allowed' : 'shadow-xl hover:shadow-2xl hover:scale-105'
                        }`}
                        style={
                          loading
                            ? undefined
                            : { background: `linear-gradient(to right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }
                        }
                      >
                        {loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            <span>Confirm Booking</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 lg:mt-10 pt-6 sm:pt-8 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setStep(4);
                        setOtpSent(false);
                        setOtpVerified(false);
                        setOtpCode('');
                      }}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-gray-700 hover:shadow-md"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Success */}
              {/* Step 6: Confirmation */}
              {step === 6 && (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 lg:py-16 animate-fadeIn">
                  {/* Success Animation */}
                  <div className="relative mb-6 sm:mb-8">
                    <div 
                      className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full flex items-center justify-center shadow-2xl relative overflow-hidden"
                      style={{ background: `linear-gradient(to bottom right, ${workspacePrimaryColor}, ${workspaceAccentColor})` }}
                    >
                      {/* Animated Ring */}
                      <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
                      <div className="absolute inset-2 rounded-full border-4 border-white/20" />
                      
                      {/* Checkmark */}
                      <svg
                        className="relative z-10 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    
                    {/* Confetti Effect */}
                    <div className="absolute inset-0 pointer-events-none">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 rounded-full"
                          style={{
                            background: [workspacePrimaryColor, workspaceAccentColor, '#10B981', '#F59E0B'][i % 4],
                            left: '50%',
                            top: '50%',
                            transform: `rotate(${i * 30}deg) translateY(-60px)`,
                            animation: `fadeIn 0.5s ease-out ${i * 0.1}s both`
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Success Message */}
                  <div className="text-center space-y-3 sm:space-y-4 px-4">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-600 to-gray-900 bg-clip-text text-transparent">
                      You're all set! 🎉
                    </h2>
                    <p className="text-lg sm:text-xl text-gray-600">See you soon 👋</p>
                    
                    {/* Booking Summary */}
                    <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl sm:rounded-2xl border-2 border-purple-100 max-w-md mx-auto w-full">
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: workspacePrimaryColor }}>
                            {selectedType && getServiceIcon(selectedType.duration_minutes || 30)}
                          </div>
                          <div className="text-left min-w-0 flex-1">
                            <div className="font-bold text-gray-900 text-base sm:text-lg truncate">{selectedType?.title}</div>
                            <div className="text-xs sm:text-sm text-gray-600">
                              {selectedDate ? fmtDay(selectedDate) : ''} • {selectedTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Decorative Elements */}
                    <div className="mt-8 flex items-center justify-center gap-2 text-gray-400">
                      <div className="w-12 h-px bg-gradient-to-r from-transparent to-gray-300" />
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                      <div className="w-12 h-px bg-gradient-to-l from-transparent to-gray-300" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EmbedBookingForm;