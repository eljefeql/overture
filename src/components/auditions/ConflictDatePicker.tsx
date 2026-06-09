"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Plus, X, CalendarBlank } from "@phosphor-icons/react";

export type ConflictDate = {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
};

type Props = {
  conflicts: ConflictDate[];
  onChange: (conflicts: ConflictDate[]) => void;
  /** Earliest selectable date (e.g. rehearsal start) */
  minDate?: string;
  /** Latest selectable date (e.g. show close) */
  maxDate?: string;
};

export function ConflictDatePicker({
  conflicts,
  onChange,
  minDate,
  maxDate,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const addConflict = () => {
    if (!startDate) return;
    const conflict: ConflictDate = {
      id: `conflict-${Date.now()}`,
      startDate,
      endDate: endDate || startDate, // single day if no end
    };
    onChange([...conflicts, conflict]);
    setStartDate("");
    setEndDate("");
    setAdding(false);
  };

  const removeConflict = (id: string) => {
    onChange(conflicts.filter((c) => c.id !== id));
  };

  const formatConflictLabel = (c: ConflictDate) => {
    const start = formatShort(c.startDate);
    if (c.startDate === c.endDate) return start;
    return `${start} – ${formatShort(c.endDate)}`;
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-2">
        Scheduling Conflicts
      </label>
      <p className="text-xs text-clay-400 mb-3">
        Mark any dates you&apos;re unavailable between rehearsals and performances.
      </p>

      {/* Conflict chips */}
      {conflicts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {conflicts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ruby-50 text-ruby-600 text-xs font-medium border border-ruby-200"
            >
              <CalendarBlank className="w-3.5 h-3.5" weight="bold" />
              {formatConflictLabel(c)}
              <button
                onClick={() => removeConflict(c.id)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-ruby-100 transition"
                aria-label={`Remove conflict ${formatConflictLabel(c)}`}
              >
                <X className="w-3 h-3" weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add conflict form */}
      {adding ? (
        <div className="bg-cream-50 rounded-xl border border-cream-200 p-4 animate-fade-up">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[11px] font-medium text-clay-500 mb-1">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // Auto-set end date if empty or before start
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                min={minDate}
                max={maxDate}
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 bg-white focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-clay-500 mb-1">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || minDate}
                max={maxDate}
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 bg-white focus:ring-2 focus:ring-curtain-200 focus:border-curtain-300 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={addConflict}
              disabled={!startDate}
            >
              Add Conflict
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setStartDate("");
                setEndDate("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-cream-400 text-xs font-medium text-clay-500 hover:border-curtain-300 hover:text-curtain-700 transition"
        >
          <Plus className="w-3.5 h-3.5" weight="bold" />
          Add a conflict
        </button>
      )}
    </div>
  );
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
