import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Check, ChevronRight } from 'lucide-react';
import { formatAppointmentTimestamp, parseAppointmentTimestamp, getTodayString } from '../../services/db';

interface DateTimePickerProps {
  value?: string; // ISO 8601 UTC string or YYYY-MM-DDTHH:mm
  onChange: (isoTimestamp: string) => void;
  label?: string;
  required?: boolean;
  minDate?: string;
  durationMinutes?: number;
  onDurationChange?: (minutes: number) => void;
  className?: string;
}

const COMMON_TIME_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
];

const DURATION_OPTIONS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
];

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  label = 'Appointment Date & Time',
  required = false,
  minDate,
  durationMinutes = 30,
  onDurationChange,
  className = '',
}) => {
  const initialParsed = parseAppointmentTimestamp(value || '');
  const [selectedDate, setSelectedDate] = useState<string>(
    initialParsed.date || getTodayString()
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    initialParsed.time || '10:00'
  );
  const [showPresets, setShowPresets] = useState<boolean>(false);

  // Sync internal state if incoming value changes externally
  useEffect(() => {
    if (value) {
      const p = parseAppointmentTimestamp(value);
      if (p.date && p.date !== selectedDate) setSelectedDate(p.date);
      if (p.time && p.time !== selectedTime) setSelectedTime(p.time);
    }
  }, [value]);

  // Compute and emit consistent ISO timestamp whenever date or time changes
  const updateTimestamp = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    const isoString = formatAppointmentTimestamp(date, time);
    onChange(isoString);
  };

  // Quick preset dates
  const handleQuickDatePreset = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    updateTimestamp(dateStr, selectedTime);
  };

  const handleNextMonday = () => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const distanceToMonday = (1 + 7 - dayOfWeek) % 7 || 7;
    d.setDate(d.getDate() + distanceToMonday);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    updateTimestamp(dateStr, selectedTime);
  };

  const currentFormatted = parseAppointmentTimestamp(
    formatAppointmentTimestamp(selectedDate, selectedTime)
  );

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-[11px] text-slate-400 font-medium">
            Timezone: {localTz.split('/')[1]?.replace('_', ' ') || localTz}
          </span>
        </div>
      )}

      {/* Date & Time Inputs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Date Selector */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Calendar className="w-4 h-4" />
          </div>
          <input
            type="date"
            required={required}
            min={minDate || getTodayString()}
            value={selectedDate}
            onChange={(e) => updateTimestamp(e.target.value, selectedTime)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow"
          />
        </div>

        {/* Time Selector */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Clock className="w-4 h-4" />
          </div>
          <input
            type="time"
            required={required}
            value={selectedTime}
            onChange={(e) => updateTimestamp(selectedDate, e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow"
          />
        </div>
      </div>

      {/* Quick Date Presets */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] text-slate-400 font-medium mr-1">Quick Presets:</span>
        <button
          type="button"
          onClick={() => handleQuickDatePreset(0)}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
            selectedDate === getTodayString()
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => handleQuickDatePreset(1)}
          className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent transition-colors"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => handleQuickDatePreset(2)}
          className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent transition-colors"
        >
          In 2 Days
        </button>
        <button
          type="button"
          onClick={handleNextMonday}
          className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent transition-colors"
        >
          Next Monday
        </button>
      </div>

      {/* Popular Time Slots Pills */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-slate-400 font-medium">Popular Times:</span>
          {onDurationChange && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 font-medium">Duration:</span>
              <div className="flex rounded-md border border-slate-200 overflow-hidden bg-slate-50 p-0.5">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onDurationChange(opt.value)}
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                      durationMinutes === opt.value
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
          {COMMON_TIME_SLOTS.slice(0, 10).map((slot) => {
            const isSelected = selectedTime === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => updateTimestamp(selectedDate, slot)}
                className={`px-2 py-1 text-xs rounded-lg font-mono font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      {/* Verified ISO Preview Pill */}
      <div className="mt-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>
            Scheduled for: <strong className="font-semibold">{currentFormatted.fullDisplay}</strong>
            {durationMinutes ? ` (${durationMinutes} mins)` : ''}
          </span>
        </div>
        <span className="text-[10px] font-mono text-blue-500 bg-blue-100/60 px-1.5 py-0.5 rounded">
          Firebase ISO 8601
        </span>
      </div>
    </div>
  );
};
