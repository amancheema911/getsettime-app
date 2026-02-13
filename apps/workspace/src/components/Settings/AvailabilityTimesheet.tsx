"use client";

import React, { useState, useEffect } from 'react';

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

interface AvailabilityTimesheetProps {
  onSave?: (data: Record<DayName, DaySchedule>) => void;
}

const DAYS: DayName[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_NAMES: Record<DayName, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const displayTime = formatTimeForDisplay(time);
      options.push({ value: time, label: displayTime });
    }
  }
  return options;
};

const formatTimeForDisplay = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const timeOptions = generateTimeOptions();

// Helper function to compare times (returns true if time1 is after time2)
const isTimeAfter = (time1: string, time2: string): boolean => {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  const totalMinutes1 = h1 * 60 + m1;
  const totalMinutes2 = h2 * 60 + m2;
  return totalMinutes1 > totalMinutes2;
};

// Helper function to check if time is equal
const isTimeEqual = (time1: string, time2: string): boolean => {
  return time1 === time2;
};

// Helper function to filter time options based on constraints
const getFilteredTimeOptions = (
  minTime?: string,
  maxTime?: string,
  excludeEqual?: boolean
) => {
  return timeOptions.filter((option) => {
    // Filter by minimum time
    if (minTime) {
      if (excludeEqual) {
        // Exclude times that are <= minTime (only allow times > minTime)
        if (!isTimeAfter(option.value, minTime)) {
          return false;
        }
      } else {
        // Exclude times that are < minTime (allow times >= minTime)
        if (!isTimeAfter(option.value, minTime) && !isTimeEqual(option.value, minTime)) {
          return false;
        }
      }
    }
    // Filter by maximum time (exclude times > maxTime)
    if (maxTime && isTimeAfter(option.value, maxTime)) {
      return false;
    }
    return true;
  });
};

// Helper function to convert time to angle (0-360 degrees)
const timeToAngle = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  return (totalMinutes / (24 * 60)) * 360 - 90; // -90 to start at top
};

// Visual Availability Clock Component
const VisualAvailabilityClock: React.FC<{
  startTime: string;
  endTime: string;
  breaks: BreakTime[];
}> = ({ startTime, endTime, breaks }) => {
  const startAngle = timeToAngle(startTime);
  const endAngle = timeToAngle(endTime);
  const startDisplay = formatTimeForDisplay(startTime);
  const endDisplay = formatTimeForDisplay(endTime);

  // Calculate the sweep angle
  let sweepAngle = endAngle - startAngle;
  if (sweepAngle < 0) sweepAngle += 360;

  // Helper to draw arc segments
  const drawArc = (startAngle: number, endAngle: number, radius: number, largeArc: boolean) => {
    const startX = 100 + radius * Math.cos((startAngle * Math.PI) / 180);
    const startY = 100 + radius * Math.sin((startAngle * Math.PI) / 180);
    const endX = 100 + radius * Math.cos((endAngle * Math.PI) / 180);
    const endY = 100 + radius * Math.sin((endAngle * Math.PI) / 180);
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc ? 1 : 0} 1 ${endX} ${endY}`;
  };

  // Calculate available segments (excluding breaks)
  const calculateSegments = () => {
    const segments: Array<{ start: number; end: number }> = [];
    let currentStart = startAngle;
    
    // Sort breaks by start time
    const sortedBreaks = [...breaks].sort((a, b) => {
      const aStart = timeToAngle(a.start);
      const bStart = timeToAngle(b.start);
      return aStart - bStart;
    });

    for (const breakTime of sortedBreaks) {
      const breakStart = timeToAngle(breakTime.start);
      const breakEnd = timeToAngle(breakTime.end);
      
      // If break is within our time range, split the segment
      if (breakStart >= currentStart && breakStart <= endAngle) {
        if (currentStart < breakStart) {
          segments.push({ start: currentStart, end: breakStart });
        }
        currentStart = Math.max(currentStart, breakEnd);
      }
    }
    
    // Add final segment
    if (currentStart < endAngle) {
      segments.push({ start: currentStart, end: endAngle });
    }
    
    return segments.length > 0 ? segments : [{ start: startAngle, end: endAngle }];
  };

  const availableSegments = calculateSegments();

  return (
    <div className="flex flex-col items-center">
        
        <div className="flex items-center justify-center">
          <div className="relative h-56 w-56 rounded-full bg-slate-900 shadow-inner">
            <div className="absolute inset-4 rounded-full border border-indigo-400/30" />
            <div className="absolute inset-10 rounded-full border border-indigo-400/20" />

            {/* Time markers */}
            <span className="absolute left-1/2 top-2 -translate-x-1/2 text-[10px] text-indigo-300">9 AM</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-indigo-300">12 PM</span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-indigo-300">5 PM</span>

            {/* Active arc (visual only) */}
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_210deg,rgba(99,102,241,0.0),rgba(99,102,241,0.9),rgba(168,85,247,0.9),rgba(99,102,241,0.0))] opacity-80" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-slate-900 rounded-full w-24 h-24 flex flex-col items-center justify-center">
                    <div className="text-white text-sm font-medium">{startDisplay}</div>
                    <div className="text-slate-400 text-xs">-</div>
                    <div className="text-white text-sm font-medium">{endDisplay}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default function AvailabilityTimesheet({ onSave }: AvailabilityTimesheetProps) {
  const [schedules, setSchedules] = useState<Record<DayName, DaySchedule>>(() => {
    const defaultSchedule: DaySchedule = {
      enabled: false,
      startTime: '09:00',
      endTime: '17:00',
      breaks: [],
    };
    return {
      Sun: { ...defaultSchedule },
      Mon: { ...defaultSchedule, enabled: true },
      Tue: { ...defaultSchedule, enabled: true },
      Wed: { ...defaultSchedule, enabled: true },
      Thu: { ...defaultSchedule, enabled: true },
      Fri: { ...defaultSchedule, enabled: true },
      Sat: { ...defaultSchedule },
    };
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/settings', {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.settings?.availability?.timesheet) {
          setSchedules(data.settings.availability.timesheet);
        }
      } else if (response.status === 404) {
        // API route doesn't exist yet, use default schedules
        console.log('Settings API not found, using default schedules');
      }
    } catch (error) {
      console.error('Error loading availability timesheet:', error);
      // Continue with default schedules if API fails
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Validate all schedules before saving
      const validationErrors: string[] = [];
      
      Object.entries(schedules).forEach(([day, schedule]) => {
        if (schedule.enabled) {
          // Validate end time is after start time
          if (!isTimeAfter(schedule.endTime, schedule.startTime)) {
            validationErrors.push(`${DAY_NAMES[day as DayName]}: End time must be after start time`);
          }
          
          // Validate all breaks
          schedule.breaks.forEach((breakTime, index) => {
            if (!isTimeAfter(breakTime.start, schedule.startTime)) {
              validationErrors.push(`${DAY_NAMES[day as DayName]}: Break ${index + 1} start must be after day start time`);
            }
            if (!isTimeAfter(schedule.endTime, breakTime.end)) {
              validationErrors.push(`${DAY_NAMES[day as DayName]}: Break ${index + 1} end must be before day end time`);
            }
            if (!isTimeAfter(breakTime.end, breakTime.start)) {
              validationErrors.push(`${DAY_NAMES[day as DayName]}: Break ${index + 1} end must be after break start time`);
            }
          });
        }
      });
      
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed:\n${validationErrors.join('\n')}`);
      }

      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const settingsData = {
        availability: {
          timesheet: schedules,
        },
      };

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ settings: settingsData }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to save availability timesheet');
      }

      setSaveMessage({ type: 'success', text: 'Availability timesheet saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);

      if (onSave) {
        onSave(schedules);
      }
    } catch (error) {
      console.error('Error saving availability timesheet:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save availability timesheet. Please try again.',
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const updateDaySchedule = (day: DayName, updates: Partial<DaySchedule>) => {
    setSchedules((prev) => {
      const currentSchedule = prev[day];
      const newSchedule = { ...currentSchedule, ...updates };
      
      // If start time changed, validate and reset end time if invalid
      if (updates.startTime !== undefined) {
        if (!isTimeAfter(newSchedule.endTime, newSchedule.startTime)) {
          // Find next valid end time (30 minutes after start)
          const [hours, minutes] = newSchedule.startTime.split(':').map(Number);
          const nextValidMinutes = (hours * 60 + minutes + 30) % (24 * 60);
          const nextValidHours = Math.floor(nextValidMinutes / 60);
          const nextValidMins = nextValidMinutes % 60;
          newSchedule.endTime = `${nextValidHours.toString().padStart(2, '0')}:${nextValidMins.toString().padStart(2, '0')}`;
        }
        
        // Validate and reset breaks that are now invalid
        newSchedule.breaks = newSchedule.breaks
          .map((breakTime) => {
            // Reset break if start is before day start or end is after day end
            if (!isTimeAfter(breakTime.start, newSchedule.startTime) || 
                !isTimeAfter(newSchedule.endTime, breakTime.end)) {
              // Reset to default valid break time
              const [startHours, startMins] = newSchedule.startTime.split(':').map(Number);
              const [endHours, endMins] = newSchedule.endTime.split(':').map(Number);
              const startTotal = startHours * 60 + startMins;
              const endTotal = endHours * 60 + endMins;
              const midTotal = Math.floor((startTotal + endTotal) / 2);
              const breakStartHours = Math.floor(midTotal / 60);
              const breakStartMins = midTotal % 60;
              const breakEndHours = Math.floor((midTotal + 60) / 60);
              const breakEndMins = (midTotal + 60) % 60;
              
              return {
                ...breakTime,
                start: `${breakStartHours.toString().padStart(2, '0')}:${breakStartMins.toString().padStart(2, '0')}`,
                end: `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`,
              };
            }
            // Also validate break end is after break start
            if (!isTimeAfter(breakTime.end, breakTime.start)) {
              const [breakStartHours, breakStartMins] = breakTime.start.split(':').map(Number);
              const breakStartTotal = breakStartHours * 60 + breakStartMins;
              const breakEndTotal = breakStartTotal + 60; // 1 hour after break start
              const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
              const breakEndMins = breakEndTotal % 60;
              return {
                ...breakTime,
                end: `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`,
              };
            }
            return breakTime;
          })
          .filter((breakTime) => {
            // Remove breaks that are completely outside the day range
            return isTimeAfter(breakTime.start, newSchedule.startTime) && 
                   isTimeAfter(newSchedule.endTime, breakTime.end);
          });
      }
      
      // If end time changed, validate and reset breaks if invalid
      if (updates.endTime !== undefined) {
        newSchedule.breaks = newSchedule.breaks
          .map((breakTime) => {
            // Reset break end if it's after day end
            if (!isTimeAfter(newSchedule.endTime, breakTime.end)) {
              // Set break end to 30 minutes before day end, or 30 minutes after break start, whichever is earlier
              const [endHours, endMins] = newSchedule.endTime.split(':').map(Number);
              const [breakStartHours, breakStartMins] = breakTime.start.split(':').map(Number);
              const endTotal = endHours * 60 + endMins;
              const breakStartTotal = breakStartHours * 60 + breakStartMins;
              const maxBreakEndTotal = endTotal - 30; // 30 minutes before day end
              const minBreakEndTotal = breakStartTotal + 30; // 30 minutes after break start
              const breakEndTotal = Math.min(maxBreakEndTotal, minBreakEndTotal);
              const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
              const breakEndMins = breakEndTotal % 60;
              return {
                ...breakTime,
                end: `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`,
              };
            }
            return breakTime;
          })
          .filter((breakTime) => {
            // Remove breaks that are completely outside the day range
            return isTimeAfter(breakTime.start, newSchedule.startTime) && 
                   isTimeAfter(newSchedule.endTime, breakTime.end);
          });
      }
      
      return {
        ...prev,
        [day]: newSchedule,
      };
    });
  };

  const addBreak = (day: DayName) => {
    const daySchedule = schedules[day];
    // Calculate a valid default break time (middle of the day, 1 hour duration)
    const [startHours, startMins] = daySchedule.startTime.split(':').map(Number);
    const [endHours, endMins] = daySchedule.endTime.split(':').map(Number);
    const startTotal = startHours * 60 + startMins;
    const endTotal = endHours * 60 + endMins;
    const midTotal = Math.floor((startTotal + endTotal) / 2);
    const breakStartHours = Math.floor(midTotal / 60) % 24;
    const breakStartMins = midTotal % 60;
    const breakEndTotal = Math.min(midTotal + 60, endTotal - 30); // 1 hour break, but at least 30 min before day end
    const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
    const breakEndMins = breakEndTotal % 60;
    
    const newBreak: BreakTime = {
      id: `break-${Date.now()}-${Math.random()}`,
      start: `${breakStartHours.toString().padStart(2, '0')}:${breakStartMins.toString().padStart(2, '0')}`,
      end: `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`,
    };
    updateDaySchedule(day, {
      breaks: [...daySchedule.breaks, newBreak],
    });
  };

  const removeBreak = (day: DayName, breakId: string) => {
    const daySchedule = schedules[day];
    updateDaySchedule(day, {
      breaks: daySchedule.breaks.filter((b) => b.id !== breakId),
    });
  };

  const updateBreak = (day: DayName, breakId: string, field: 'start' | 'end', value: string) => {
    const daySchedule = schedules[day];
    const updatedBreaks = daySchedule.breaks.map((b) => {
      if (b.id !== breakId) return b;
      
      const updatedBreak = { ...b, [field]: value };
      
      // If break start changed, validate and reset break end if invalid
      if (field === 'start') {
        // Ensure break start is after day start
        if (!isTimeAfter(updatedBreak.start, daySchedule.startTime)) {
          // Reset to 30 minutes after day start
          const [startHours, startMins] = daySchedule.startTime.split(':').map(Number);
          const breakStartTotal = startHours * 60 + startMins + 30;
          const breakStartHours = Math.floor(breakStartTotal / 60) % 24;
          const breakStartMins = breakStartTotal % 60;
          updatedBreak.start = `${breakStartHours.toString().padStart(2, '0')}:${breakStartMins.toString().padStart(2, '0')}`;
        }
        
        // Ensure break end is after break start and before day end
        if (!isTimeAfter(updatedBreak.end, updatedBreak.start) || 
            !isTimeAfter(daySchedule.endTime, updatedBreak.end)) {
          // Set break end to 30 minutes after break start, but not after day end
          const [breakStartHours, breakStartMins] = updatedBreak.start.split(':').map(Number);
          const [endHours, endMins] = daySchedule.endTime.split(':').map(Number);
          const breakStartTotal = breakStartHours * 60 + breakStartMins;
          const endTotal = endHours * 60 + endMins;
          const breakEndTotal = Math.min(breakStartTotal + 30, endTotal - 30);
          const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
          const breakEndMins = breakEndTotal % 60;
          updatedBreak.end = `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`;
        }
      }
      
      // If break end changed, validate it's after break start and before day end
      if (field === 'end') {
        if (!isTimeAfter(updatedBreak.end, updatedBreak.start)) {
          // Reset to 30 minutes after break start
          const [breakStartHours, breakStartMins] = updatedBreak.start.split(':').map(Number);
          const breakStartTotal = breakStartHours * 60 + breakStartMins;
          const breakEndTotal = breakStartTotal + 30;
          const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
          const breakEndMins = breakEndTotal % 60;
          updatedBreak.end = `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`;
        }
        if (!isTimeAfter(daySchedule.endTime, updatedBreak.end)) {
          // Reset to 30 minutes before day end
          const [endHours, endMins] = daySchedule.endTime.split(':').map(Number);
          const endTotal = endHours * 60 + endMins;
          const breakEndTotal = endTotal - 30;
          const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
          const breakEndMins = breakEndTotal % 60;
          updatedBreak.end = `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`;
        }
      }
      
      return updatedBreak;
    });
    
    updateDaySchedule(day, {
      breaks: updatedBreaks,
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-400">Loading availability timesheet...</div>
    );
  }

  return (
    <div className="rounded-xl">
      {/* <h4 className="text-xl font-semibold mb-6">Availability Timesheet</h4> */}

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
        {DAYS.map((day) => {
          const schedule = schedules[day];
          const dayLetter = day[0];
          const dayFullName = DAY_NAMES[day];
          
          return (
            <div
              key={day}
              className="bg-white rounded-xl p-6 shadow-sm"
            >
              {/* Header Section */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  {/* Day Icon */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">{dayLetter}</span>
                    </div>
                    {schedule.enabled && (
                      <div className="absolute top-1 -right-1 w-4 h-4 rounded-full bg-teal-400"></div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-800">{dayFullName}</h3>
                    <p className="text-sm text-slate-400 mt-1">Visual availability clock</p>
                  </div>
                </div>

                {/* Available Button */}
                <button
                  type="button"
                  onClick={() => updateDaySchedule(day, { enabled: !schedule.enabled })}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    schedule.enabled
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {schedule.enabled ? 'Available' : 'Unavailable'}
                </button>
              </div>

              {schedule.enabled && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Visual Availability Clock - Left Side */}
                  <div className="flex items-center justify-center">
                    <VisualAvailabilityClock
                      startTime={schedule.startTime}
                      endTime={schedule.endTime}
                      breaks={schedule.breaks}
                    />
                  </div>

                  {/* Controls - Right Side */}
                  <div className="space-y-4">
                    {/* Time Settings */}
                    <div className="bg-gray-100 rounded-lg p-3 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-2">START</label>
                        <div className="relative">
                          <select
                            value={schedule.startTime}
                            onChange={(e) => updateDaySchedule(day, { startTime: e.target.value })}
                            className="w-full px-3 py-2 rounded bg-gray-200 text-sm appearance-none pr-8"
                          >
                            {timeOptions.map((option) => (
                              <option key={option.value} value={option.value} className="bg-gray-200">
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-2">END</label>
                        <div className="relative">
                          <select
                            value={schedule.endTime}
                            onChange={(e) => updateDaySchedule(day, { endTime: e.target.value })}
                            className="w-full px-3 py-2 rounded bg-gray-200 text-sm appearance-none pr-8"
                          >
                            {getFilteredTimeOptions(schedule.startTime, undefined, true).map((option) => (
                              <option key={option.value} value={option.value} className="bg-gray-200">
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Breaks Section */}
                    <div className="bg-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">Breaks</label>
                        <button
                          type="button"
                          onClick={() => addBreak(day)}
                          className="px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-xs font-medium"
                        >
                          + Add
                        </button>
                      </div>

                      {schedule.breaks.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No breaks configured</p>
                      ) : (
                        <div className="space-y-2">
                          {schedule.breaks.map((breakTime) => (
                            <div
                              key={breakTime.id}
                              className="flex items-center gap-2 rounded-lg"
                            >
                              <div className="relative flex-1">
                                <select
                                  value={breakTime.start}
                                  onChange={(e) =>
                                    updateBreak(day, breakTime.id, 'start', e.target.value)
                                  }
                                  className="w-full px-3 py-2 rounded bg-gray-200 text-sm appearance-none pr-8"
                                >
                                  {getFilteredTimeOptions(schedule.startTime, schedule.endTime, true).map((option) => (
                                    <option key={option.value} value={option.value} className="bg-gray-200">
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                              <span className="text-slate-400 text-sm">–</span>
                              <div className="relative flex-1">
                                <select
                                  value={breakTime.end}
                                  onChange={(e) =>
                                    updateBreak(day, breakTime.id, 'end', e.target.value)
                                  }
                                  className="w-full px-3 py-2 rounded bg-gray-200 text-sm appearance-none pr-8"
                                >
                                  {getFilteredTimeOptions(breakTime.start, schedule.endTime, true).map((option) => (
                                    <option key={option.value} value={option.value} className="bg-gray-200">
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeBreak(day, breakTime.id)}
                                className="px-3 py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!schedule.enabled && (
                <div className="text-center py-8 text-slate-500">
                  <p>This day is currently unavailable</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {saveMessage && (
        <div
          className={`mt-6 p-4 rounded-lg text-sm font-medium ${
            saveMessage.type === 'success'
              ? 'bg-green-900/50 text-green-300 border border-green-700'
              : 'bg-red-900/50 text-red-300 border border-red-700'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      <div className="mt-8 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`px-8 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium ${
            isSaving ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isSaving ? 'Saving...' : 'Save Timesheet'}
        </button>
      </div>
    </div>
  );
}