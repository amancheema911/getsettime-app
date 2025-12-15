"use client";

import React, { useState, useEffect, useMemo } from 'react';

interface EventType {
  id: string;
  title: string;
  duration_minutes: number | null;
}

interface MultiStepBookingFormProps {
  onSave: () => void;
  onCancel: () => void;
}

const MultiStepBookingForm = ({ onSave, onCancel }: MultiStepBookingFormProps) => {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);

  const timeslots = useMemo(() => {
    if (!selectedType) {
      return [];
    }

    const duration = selectedType.duration_minutes || 30;
    const slots: string[] = [];
    
    // Define working hours (9 AM to 5 PM)
    const startHour = 9;
    const endHour = 17;
    const totalMinutes = (endHour - startHour) * 60;
    
    // Generate slots based on duration
    for (let minutes = 0; minutes < totalMinutes; minutes += duration) {
      const totalMinutesFromStart = startHour * 60 + minutes;
      const hour = Math.floor(totalMinutesFromStart / 60);
      const minute = totalMinutesFromStart % 60;
      
      // Skip if slot would extend beyond end hour
      if (hour >= endHour || (hour === endHour - 1 && minute + duration > 60)) {
        break;
      }
      
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const displayMinute = minute.toString().padStart(2, '0');
      
      slots.push(`${displayHour}:${displayMinute} ${period}`);
    }
    
    return slots;
  }, [selectedType]);

  const days = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

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
        setConfirmed(false);
        onSave();
      }, 3700);
      return () => clearTimeout(t);
    }
  }, [confirmed, onSave]);

  useEffect(() => {
    // Reset selected time when event type changes
    if (selectedType) {
      setSelectedTime('');
    }
  }, [selectedType]);

  const handleConfirm = async () => {
    if (!selectedType || !selectedDate || !selectedTime || !name.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Parse time and combine with date
      const [time, period] = selectedTime.split(' ');
      const [hours, minutes] = time.split(':');
      let hour24 = parseInt(hours, 10);
      if (period === 'PM' && hour24 !== 12) hour24 += 12;
      if (period === 'AM' && hour24 === 12) hour24 = 0;

      const startDate = new Date(selectedDate);
      startDate.setHours(hour24, parseInt(minutes, 10), 0, 0);

      // Calculate end date based on duration
      const endDate = new Date(startDate);
      const duration = selectedType.duration_minutes || 30;
      endDate.setMinutes(endDate.getMinutes() + duration);

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          event_type_id: selectedType.id,
          invitee_name: name.trim(),
          invitee_email: email.trim() || null,
          invitee_phone: phone.trim() || null,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          status: 'pending',
          metadata: notes.trim() ? { notes: notes.trim() } : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      setConfirmed(true);
      setStep(4);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-3xl shadow-2xl overflow-hidden bg-white relative">
        {/* Header */}
        <div className="px-6 py-6 bg-gradient-to-r from-[#E8F8F0] to-[#FFF2F0] z-10 relative">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: '#2ECC71', color: '#fff' }}>🌿</div>
            <div>
              <div className="text-sm text-gray-600">Schedule with</div>
              <div className="text-lg font-semibold">Deep — Friendly Scheduling</div>
            </div>
            <div className="ml-auto text-sm text-gray-500">Step {step} of 4</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 relative">
          <div className="flex items-center gap-3 mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full ${s <= step ? 'bg-[#2ECC71]' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="relative min-h-[280px]">
            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-sm text-gray-500 mb-2">What would you like to book?</div>
                {loadingEventTypes ? (
                  <div className="text-center py-8 text-gray-500">Loading event types...</div>
                ) : eventTypes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No event types available</p>
                    <p className="text-xs mt-2">Please create an event type first</p>
                  </div>
                ) : (
                  eventTypes.map((t) => {
                    const duration = t.duration_minutes || 30;
                    const emoji = duration <= 30 ? '💬' : duration <= 60 ? '🎯' : '👥';
                    const subtitle = duration <= 30 ? 'Quick friendly catch-up' : duration <= 60 ? 'Deep strategy session' : 'Team or class booking';
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
                          <div className="font-semibold text-gray-800">{t.title}</div>
                          <div className="text-sm text-gray-500">{subtitle}</div>
                        </div>
                        <div className="ml-auto text-sm text-gray-400">Choose</div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-sm text-gray-500">Pick a day</div>
                <div className="flex gap-3 overflow-x-auto pb-3">
                  {days.map((d) => (
                    <button
                      key={d.toISOString()}
                      onClick={() => {
                        setSelectedDate(d);
                        setSelectedTime('');
                      }}
                      className={`flex-none min-w-[96px] p-3 rounded-xl transition ${
                        selectedDate?.toDateString() === d.toDateString()
                          ? 'bg-[#2ECC71] text-white'
                          : 'bg-white border shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="text-xs">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="font-medium text-sm">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    </button>
                  ))}
                </div>

                <div className="text-sm text-gray-500">Available times</div>
                {timeslots.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Please select an event type first
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {timeslots.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        disabled={!selectedDate}
                        className={`p-3 rounded-xl transition ${
                          selectedTime === t
                            ? 'bg-[#FF6B6B] text-white'
                            : 'bg-white border shadow-sm hover:shadow-md'
                        } ${!selectedDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {t}
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
                        : 'bg-[#2ECC71] hover:bg-[#27AE60]'
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-sm text-gray-500">Tell us how to reach you ✨</div>
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
                    onClick={handleConfirm}
                    disabled={loading || !name.trim()}
                    className={`ml-auto px-6 py-2 rounded-xl text-white transition ${
                      loading || !name.trim()
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-[#2ECC71] hover:bg-[#27AE60]'
                    }`}
                  >
                    {loading ? 'Creating...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
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
                <div className="text-lg font-semibold text-gray-800">You're all set — see you soon 👋</div>
                <div className="text-sm text-gray-500 mt-2">
                  {selectedType?.title} • {selectedDate ? fmtDay(selectedDate) : ''} • {selectedTime}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiStepBookingForm;

