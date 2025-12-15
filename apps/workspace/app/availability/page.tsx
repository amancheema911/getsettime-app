"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  isSameWeek,
  eachDayOfInterval,
} from "date-fns";

type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export default function Availability() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [hasSelectedDate, setHasSelectedDate] = useState(true);
  const calendarRef = useRef<HTMLDivElement>(null);
  const startWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startWeek, i));

  const hours = Array.from({ length: 12 }, (_, i) => i + 8);
  const [preset, setPreset] = useState("break");
  const [enabled, setEnabled] = useState<Record<DayName, boolean>>({
    Mon: true,
    Tue: true,
    Wed: true,
    Thu: true,
    Fri: true,
    Sat: false,
    Sun: false,
  });

  // General preset custom availability slots (keyed by day/hour)
  const [timeSlots, setTimeSlots] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const formatHour = (hour: number) => {
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour.toString().padStart(2, "0")}:00 ${suffix}`;
  };

  // Helper function to create a unique key for day and hour
  const getTimeSlotKey = (dayName: DayName, hour: number, date?: Date) => {
    if (date) {
      return `${format(date, "yyyy-MM-dd")}-${hour}`;
    }
    return `${dayName}-${hour}`;
  };

  const isTimeSlotActive = (dayName: DayName, hour: number, date?: Date): boolean => {
    if (!enabled[dayName]) return false;
    const key = getTimeSlotKey(dayName, hour, date);

    if (preset === "general") {
      if (timeSlots[key] !== undefined) {
        return timeSlots[key];
      }
      return true;
    }

    // If not explicitly set, use preset logic as default
    if (preset === "9-5" && hour >= 9 && hour < 17) return true;
    if (preset === "mornings" && hour >= 8 && hour < 12) return true;
    if (preset === "break" && ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18))) return true;

    return false;
  };

  // Check if a time slot is in the past
  const isPastSlot = (day: Date) => {
    const today = new Date();
    const slotDate = new Date(day);

    // Compare dates only (ignore hours/time)
    slotDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return slotDate < today; // Disable only if day is before today
  };


  // Toggle individual time slot
  const toggleTimeSlot = (dayName: DayName, hour: number, date?: Date) => {
    if (preset !== "general") return; // Only allow manual toggles in General preset
    if (!enabled[dayName]) return; // Can't toggle if day is disabled

    // Prevent past hours toggle
    if (date && isPastSlot(date)) return;
    const key = getTimeSlotKey(dayName, hour, date);
    setTimeSlots((prev) => ({
      ...prev,
      [key]: !isTimeSlotActive(dayName, hour, date),
    }));
  };

  // Save availability handler
  const handleSaveAvailability = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Prepare data for saving
      const availabilityData = {
        enabled,
        timeSlots,
        preset,
        lastUpdated: new Date().toISOString(),
      };

      // Call the API to save availability
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(availabilityData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save availability');
      }

      // Show success message
      setSaveMessage({ type: 'success', text: 'Availability saved successfully!' });

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);

      console.log("Availability saved:", result);
    } catch (error) {
      console.error("Error saving availability:", error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save availability. Please try again.'
      });

      // Clear error message after 5 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const buttonBase = "px-4 py-2 rounded-xl text-sm font-medium transition duration-200";
  const primaryBtn = `${buttonBase} bg-indigo-600 text-white hover:bg-indigo-800`;
  const outlineBtn = `${buttonBase} border border-slate-300 text-slate-600 hover:bg-slate-100`;


  // disable the prev date function
  const isPrevDisabled = () => { const today = new Date();
    if (viewMode === "week") {
      return startOfWeek(currentDate, { weekStartsOn: 1 }) <= startOfWeek(today, { weekStartsOn: 1 });
    }
    return currentDate <= today;
  };

  useEffect(() => {
    setCalendarMonth(currentDate);
    setHoverDate(null);
  }, [currentDate]);

  // Handle click outside calendar to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarOpen && calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };

    if (calendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [calendarOpen]);

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const response = await fetch("/api/availability");
        if (!response.ok) {
          throw new Error("Failed to load availability");
        }

        const payload = await response.json();
        const data = payload?.data ?? payload;

        if (data?.enabled) {
          setEnabled((prev) => ({ ...prev, ...data.enabled }));
        }
        if (data?.timeSlots) {
          setTimeSlots(data.timeSlots);
        }
        if (data?.preset) {
          setPreset(data.preset);
        }
      } catch (error) {
        console.error("Error loading availability:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAvailability();
  }, []);

  const handleViewToggle = (mode: "week" | "day") => {
    if (mode === viewMode) {
      if (mode === "week") {
        setCalendarOpen((prev) => !prev);
      }
      return;
    }

    setViewMode(mode);
    setHoverDate(null);
    setHasSelectedDate(true);
    setCalendarOpen(mode === "week");
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  return (
    <section className="space-y-6">
        <header className="flex flex-wrap justify-between relative gap-3">
            <div className="text-sm text-slate-500">
                <h3 className="text-xl font-semibold text-slate-800">Schedule Availability</h3>
                <p className="text-xs text-slate-500">Adjust your availability so clients can book at your preferred times.</p>
            </div>
        </header>

        <div className="bg-white space-y-4 sm:space-y-8 w-full rounded-xl mr-auto shadow-md p-3 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-2">
                {/* Filters */}
                <div className="w-full flex justify-between flex-col sm:flex-row gap-2 sm:gap-3">

                    <div className="relative" ref={calendarRef}>
                        <div className={`flex justify-between rounded-xl border text-sm font-medium overflow-hidden touch-manipulation border-slate-300 bg-white text-slate-600`}>
                            {["week", "day"].map((mode) => (
                            <button key={mode} type="button" onClick={() => handleViewToggle(mode as "week" | "day")} className={`sm:w-40 w-full px-4 py-2.5 sm:py-2 transition ${ viewMode === mode ? "bg-indigo-600 text-white" : "hover:bg-slate-100" }`} aria-pressed={viewMode === mode} aria-expanded={viewMode === mode && calendarOpen} >
                                {mode === "week" ? "Week View" : "Day View"}
                            </button>
                            ))}
                        </div>

                        {calendarOpen && (
                            <div className={`calender-block absolute left-0  sm:right-auto sm:left-0 top-full mt-2 w-full sm:w-auto min-w-[280px] grid gap-2 rounded-2xl overflow-hidden border text-sm z-50 shadow-lg border-slate-200 bg-white text-slate-700`} >

                            <div className="px-4 py-2 bg-indigo-600 text-white flex items-center justify-between">
                                <button type="button" onClick={() => setCalendarMonth((prev) => subMonths(prev, 1))} className="text-xs cursor-pointer hover:bg-white hover:text-indigo-600 font-semibold px-2 py-1 rounded-lg disabled:opacity-40">
                                Prev
                                </button>
                                <div className="text-sm font-semibold">{format(calendarMonth, "MMMM yyyy")}</div>
                                <button type="button" onClick={() => setCalendarMonth((prev) => addMonths(prev, 1))} className="text-xs cursor-pointer hover:bg-white hover:text-indigo-600 font-semibold px-2 py-1 rounded-lg disabled:opacity-40">
                                Next
                                </button>
                            </div>

                            <div className="px-4 grid grid-cols-7 text-[11px] uppercase tracking-wide text-center">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                                <span key={day} className="font-semibold">{day}</span>
                                ))}
                            </div>

                            <div className="px-4 pb-4 grid grid-cols-7">
                                {calendarDays.map((day) => {
                                const isInactiveMonth = !isSameMonth(day, calendarMonth);
                                const isPast = isPastSlot(day);
                                const referenceDate = hoverDate ?? currentDate;
                                const isActive =
                                    viewMode === "week"
                                    ? isSameWeek(day, referenceDate, { weekStartsOn: 1 })
                                    : isSameDay(day, referenceDate);

                                return (
                                    <button
                                    key={day.toISOString()}
                                    type="button"
                                    onMouseEnter={() => setHoverDate(day)}
                                    onMouseLeave={() => setHoverDate(null)}
                                    onClick={() => { const targetDate = viewMode === "week" ? startOfWeek(day, { weekStartsOn: 1 }) : day; setCurrentDate(targetDate); setCalendarMonth(targetDate); setHoverDate(null); setCalendarOpen(false); setHasSelectedDate(true); }}
                                    disabled={isPast}
                                    className={`text-xs sm:text-sm p-1 transition border ${ isActive ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200" } ${ isInactiveMonth ? "opacity-50" : "" } ${ isPast ? "cursor-not-allowed opacity-40" : "hover:bg-[var(--theme-primary-soft)] hover:text-indigo-600" }`}>
                                    {format(day, "d")}
                                    </button>
                                );
                                })}
                            </div>
                            </div>
                        )}
                    </div>

                    <select value={preset} onChange={(e) => setPreset(e.target.value)} className={`px-4 py-2.5 sm:py-2 rounded-xl text-sm font-medium border touch-manipulation  border-slate-300 bg-white text-slate-600`}>
                        <option value="general">General</option>
                        <option value="9-5">9–5</option>
                        <option value="break">Break Time</option>
                        <option value="mornings">Mornings</option>
                    </select>

                </div>
            </div>

            {hasSelectedDate && (
            <>
                {/* Date Navigation */}
                <div className="flex items-center gap-2 sm:gap-3 justify-between">
                <button className={`${outlineBtn} text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-2 touch-manipulation ${isPrevDisabled() ? "opacity-50 cursor-not-allowed" : ""}`} disabled={isPrevDisabled()} onClick={() => { if (!isPrevDisabled()) { setCurrentDate((date) => (viewMode === "week" ? subDays(date, 7) : subDays(date, 1))); setHasSelectedDate(true);} }}>Prev</button>

                <div className="text-md sm:text-md text-center font-semibold px-2">
                    {viewMode === "week" ? `${format(startWeek, "dd MMM")} – ${format( endOfWeek(currentDate, { weekStartsOn: 1 }), "dd MMM yyyy")}` : format(currentDate, "EEE, dd MMM yyyy")}
                </div>

                <button className={`${outlineBtn} text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-2 touch-manipulation`} onClick={() => { setCurrentDate((date) => (viewMode === "week" ? addDays(date, 7) : addDays(date, 1))); setHasSelectedDate(true); }}>Next</button>
                </div>

                {/* Availability Grid - Mobile Vertical Layout / Desktop Horizontal Scroll */}
                <div className="rounded-2xl overflow-hidden border border-gray-200">
                {/* Desktop Week View - Horizontal Scroll */}
                {viewMode === "week" && (
                    <>
                    {/* Desktop Grid View */}
                    <div className="hidden lg:block overflow-x-auto">
                        {/* Hours Header */}
                        <div className="grid grid-cols-[100px_repeat(12,minmax(80px,1fr))]">
                        <div></div>
                        {hours.map((h) => (
                            <div
                              key={h}
                              className="text-xs px-2 py-3 text-center text-slate-500 font-medium min-w-[80px]"
                            >
                              {formatHour(h)}
                            </div>
                        ))}
                        </div>

                        {/* Week Days */}
                        {weekDays.map((day) => {
                        const dayName = format(day, "EEE") as DayName;
                        return (
                            <div key={dayName} className="grid grid-cols-[100px_repeat(12,minmax(80px,1fr))]">
                            <div className="px-2 py-2 border-t border-gray-200 bg-gray-50 sticky left-0 z-10">
                                <span className="text-xs font-medium">{format(day, "EEE")}</span>
                                <span className="text-[10px] ml-1 text-slate-500">{format(day, "dd MMM")}</span>
                                <label className={`inline-flex items-center mt-1 ${ isPastSlot(day) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                    <input type="checkbox" checked={!!enabled[dayName] && !isPastSlot(day)} disabled={isPastSlot(day)} onChange={(e) => !isPastSlot(day) && setEnabled ((prev) => ({ ...prev, [dayName]: e.target.checked }))} className="sr-only"/>

                                    <div className={`w-9 h-5 rounded-full p-1 transition ${ !isPastSlot(day) && enabled[dayName] ? "bg-emerald-500" : "bg-slate-300" }`}>
                                    <div
                                        className={`bg-white w-3 h-3 rounded-full shadow-md transform transition ${
                                        !isPastSlot(day) && enabled[dayName] ? "translate-x-4" : "translate-x-0"
                                        }`}
                                    ></div>
                                    </div>
                                </label>
                            </div>

                            {hours.map((h) => {
                                const active = isTimeSlotActive(dayName, h, day);
                                const isPast = isPastSlot(day);

                                return (
                                <div
                                    key={h}
                                    className={`h-full border-t border-r border-gray-200 relative min-w-[80px] transition-opacity
                                    ${isPast ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}
                                    `}
                                    onClick={() => {
                                    if (!isPast) toggleTimeSlot(dayName, h, day);
                                    }}
                                >
                                    <div
                                    className={`absolute inset-1 rounded-lg border
                                        ${active ? "bg-indigo-600/50 border-indigo-600" : "bg-gray-200 border-transparent"}
                                    `}
                                    ></div>
                                </div>
                                );
                            })}
                            </div>
                        );
                        })}
                    </div>

                    {/* Mobile Vertical Card View */}
                    <div className="lg:hidden space-y-3 p-3">
                        {weekDays.map((day) => { const dayName = format(day, "EEE") as DayName;
                        return (
                            <div key={dayName} className="border border-gray-200 rounded-lg p-3 bg-white">
                            {/* Day Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                <p className="text-sm font-semibold">{format(day, "EEE")}</p>
                                <p className="text-xs text-slate-500">{format(day, "dd MMM yyyy")}</p>
                                </div>
                                <label className={`inline-flex items-center ${ isPastSlot(day) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                <input type="checkbox" checked={!!enabled[dayName] && !isPastSlot(day)} disabled={isPastSlot(day)} onChange={(e) => !isPastSlot(day) && setEnabled((prev) => ({ ...prev, [dayName]: e.target.checked }))} className="sr-only" />
                                <div className={`w-9 h-5 rounded-full p-1 transition ${ !isPastSlot(day) && enabled[dayName] ? "bg-emerald-500" : "bg-slate-300" }`}>
                                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition ${ !isPastSlot(day) && enabled[dayName] ? "translate-x-4" : "translate-x-0" }`}></div>
                                </div>
                                </label>
                            </div>

                            {/* Time Slots Grid */}
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {hours.map((h) => {
                                const active = isTimeSlotActive(dayName, h, day);
                                const isPast = isPastSlot(day);
                                return (
                                    <div
                                    key={h}
                                    className={`p-2 rounded-lg text-center text-xs border-2 transition
                                        ${
                                        isPast
                                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                            : active
                                            ? "bg-indigo-600/20 border-indigo-600 text-indigo-600 font-medium cursor-pointer hover:opacity-80"
                                            : "bg-gray-100 border-gray-200 text-slate-500 cursor-pointer hover:opacity-80"
                                        }
                                    `}
                                    onClick={() => { if (!isPast) toggleTimeSlot(dayName, h, day); }}
                                    >
                                    <div>{formatHour(h)}</div>
                                    <div className="text-[10px] leading-tight mt-1">
                                        {active ? "Available" : "Unavailable"}
                                    </div>
                                    </div>
                                );
                                })}
                            </div>
                            </div>
                        );
                        })}
                    </div>
                    </>
                )}

                {/* Day View */}
                {viewMode === "day" && (() => { const dayName = format(currentDate, "EEE") as DayName;
                    return (
                    <>
                        {/* Desktop Day View */}
                        <div className="hidden md:block">
                        <div className="grid grid-cols-[100px_repeat(12,minmax(0,1fr))]">
                            <div className="px-3 py-3 border-t border-gray-200 bg-gray-50">
                            <span className="text-xs font-medium">{format(currentDate, "EEE")}</span>
                            <span className="text-[10px] ml-1 text-slate-500">{format(currentDate, "dd MMM")}</span>
                            <label className={`inline-flex items-center mt-2 ${ isPastSlot(currentDate) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                <input type="checkbox" checked={enabled[dayName] && !isPastSlot(currentDate)} disabled={isPastSlot(currentDate)} onChange={(e) => !isPastSlot(currentDate) && setEnabled((prev) => ({ ...prev, [dayName]: e.target.checked, })) } className="sr-only" />
                                <div className={`w-9 h-5 rounded-full p-1 transition ${ !isPastSlot(currentDate) && enabled[dayName] ? "bg-emerald-500" : "bg-slate-300" }`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition ${ !isPastSlot(currentDate) && enabled[dayName] ? "translate-x-4" : "translate-x-0" }`}></div>
                                </div>
                            </label>
                            </div>

                            {hours.map((h) => {
                            const active = isTimeSlotActive(dayName, h, currentDate);
                            return (
                                <div
                                key={h}
                                className="h-full border-t border-r border-gray-200 relative cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                    toggleTimeSlot(dayName, h, currentDate);
                                }}
                                >
                                <div className="absolute top-1 left-1 right-1 text-xs text-slate-500 font-medium flex items-center justify-between gap-1">
                                    <span>{formatHour(h)}</span>
                                </div>
                                <div
                                    className={`absolute inset-1 mt-6 rounded-lg border
                                    ${active ? "bg-indigo-600/50 border-indigo-600" : "bg-gray-200 border-transparent"}
                                    `}
                                ></div>
                                </div>
                            );
                            })}
                        </div>
                        </div>

                        {/* Mobile Day View */}
                        <div className="md:hidden p-4">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                            <p className="text-base font-semibold">{format(currentDate, "EEE")}</p>
                            <p className="text-sm text-slate-500">{format(currentDate, "dd MMM yyyy")}</p>
                            </div>
                            <label className={`inline-flex items-center ${ isPastSlot(currentDate) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                            <input type="checkbox" checked={enabled[dayName] && !isPastSlot(currentDate)} disabled={isPastSlot(currentDate)} onChange={(e) => !isPastSlot(currentDate) && setEnabled((prev) => ({ ...prev, [dayName]: e.target.checked, })) } className="sr-only" />
                            <div className={`w-9 h-5 rounded-full p-1 transition ${ !isPastSlot(currentDate) && enabled[dayName] ? "bg-emerald-500" : "bg-slate-300" }`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition ${ !isPastSlot(currentDate) && enabled[dayName] ? "translate-x-4" : "translate-x-0" }`}></div>
                            </div>
                            </label>
                        </div>

                        {/* Time Slots Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {hours.map((h) => {
                            const active = isTimeSlotActive(dayName, h, currentDate);
                            return (
                                <div
                                key={h}
                                className={`p-3 rounded-lg text-center border-2 transition
                                    ${
                                    active
                                        ? "bg-indigo-600/20 border-indigo-600 text-indigo-600 font-semibold cursor-pointer hover:opacity-80"
                                        : "bg-gray-100 border-gray-200 text-slate-600 cursor-pointer hover:opacity-80"
                                    }
                                `}
                                onClick={() => {
                                    toggleTimeSlot(dayName, h, currentDate);
                                }}
                                >
                                <div className="text-base font-medium">{formatHour(h)}</div>
                                <div className="text-[10px] mt-1">
                                    {active ? "Available" : "Unavailable"}
                                </div>
                                </div>
                            );
                            })}
                        </div>
                        </div>
                    </>
                    );
                })()}
                </div>
            </>
            )}

            {/* Save Message */}
            {saveMessage && (
            <div className={`p-3 rounded-lg text-sm font-medium ${ saveMessage.type === 'success'  ? 'bg-green-50 text-green-700 border  border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {saveMessage.text}
            </div>
            )}

            {/* Footer Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                <button onClick={handleSaveAvailability} disabled={isSaving || isLoading} className={`${primaryBtn} w-full sm:w-auto py-3 sm:py-2 touch-manipulation cursor-pointer ${ isSaving || isLoading ? 'opacity-50  cursor-not-allowed' : '' }`}>{isSaving ? 'Saving...' : isLoading ? 'Loading...' : 'Save availability'}</button>
            </div>
        </div>
    </section>
  );
}