"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
  isSameMonth,
  format,
} from "date-fns";
import { EventForm, type CalendarEvent } from "@/components/calendar/event-form";

type ViewMode = "month" | "week" | "day";

const TYPE_STYLE: Record<string, string> = {
  meeting: "border-primary/40 bg-primary/10 text-primary",
  call: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  follow_up: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  reminder: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  other: "border-border bg-muted text-foreground",
};

export function CalendarView() {
  const { account } = useAuth();
  const supabase = createClient();
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      return { start: startOfWeek(startOfMonth(currentDate)), end: endOfWeek(endOfMonth(currentDate)) };
    }
    if (view === "week") {
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
    }
    return { start: currentDate, end: currentDate };
  }, [view, currentDate]);

  const fetchEvents = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    const rangeStart = new Date(range.start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(range.end);
    rangeEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("account_id", account.id)
      .gte("start_at", rangeStart.toISOString())
      .lte("start_at", rangeEnd.toISOString())
      .order("start_at", { ascending: true });

    if (!error && data) setEvents(data as CalendarEvent[]);
    setLoading(false);
  }, [account, supabase, range]);

  useEffect(() => {
    queueMicrotask(() => void fetchEvents());
  }, [fetchEvents]);

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.start_at), day));

  const goPrev = () => {
    setCurrentDate((d) => (view === "month" ? subMonths(d, 1) : view === "week" ? subWeeks(d, 1) : subDays(d, 1)));
  };
  const goNext = () => {
    setCurrentDate((d) => (view === "month" ? addMonths(d, 1) : view === "week" ? addWeeks(d, 1) : addDays(d, 1)));
  };
  const goToday = () => setCurrentDate(new Date());

  const openNewEvent = (day: Date) => {
    setEditingEvent(null);
    setNewEventDate(day);
    setFormOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setNewEventDate(null);
    setFormOpen(true);
  };

  const monthDays = useMemo(() => eachDayOfInterval({ start: range.start, end: range.end }), [range]);
  const weekDays = useMemo(
    () => (view === "week" ? eachDayOfInterval({ start: range.start, end: range.end }) : []),
    [view, range]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={goToday}>
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">
            {view === "month" && format(currentDate, "MMMM yyyy")}
            {view === "week" && `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`}
            {view === "day" && format(currentDate, "EEEE, MMMM d, yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => openNewEvent(currentDate)}>
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading events...</div>
      ) : view === "month" ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-1.5 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayEvents = eventsForDay(day);
              const muted = !isSameMonth(day, currentDate);
              const today = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => openNewEvent(day)}
                  className={`min-h-24 border-b border-r p-1.5 last:border-r-0 cursor-pointer hover:bg-muted/40 ${
                    muted ? "bg-muted/20 text-muted-foreground" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      today ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditEvent(ev);
                        }}
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] border ${
                          TYPE_STYLE[ev.event_type] ?? TYPE_STYLE.other
                        }`}
                      >
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="border rounded-lg p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>
                  {format(day, "EEE d")}
                </span>
                <button onClick={() => openNewEvent(day)} className="text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {eventsForDay(day).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => openEditEvent(ev)}
                    className={`block w-full truncate rounded px-1.5 py-1 text-left text-xs border ${
                      TYPE_STYLE[ev.event_type] ?? TYPE_STYLE.other
                    }`}
                  >
                    {!ev.all_day && <span className="mr-1 opacity-70">{format(new Date(ev.start_at), "HH:mm")}</span>}
                    {ev.title}
                  </button>
                ))}
                {eventsForDay(day).length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No events</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg p-3 space-y-2">
          {eventsForDay(currentDate).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No events on this day.</p>
          ) : (
            eventsForDay(currentDate).map((ev) => (
              <button
                key={ev.id}
                onClick={() => openEditEvent(ev)}
                className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium text-sm">{ev.title}</p>
                  {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!ev.all_day && (
                    <span className="text-xs text-muted-foreground">{format(new Date(ev.start_at), "HH:mm")}</span>
                  )}
                  <Badge variant="outline" className={`capitalize ${TYPE_STYLE[ev.event_type] ?? ""}`}>
                    {ev.event_type.replace("_", " ")}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <EventForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingEvent(null);
            setNewEventDate(null);
          }
        }}
        event={editingEvent}
        defaultDate={newEventDate}
        onSaved={fetchEvents}
      />
    </div>
  );
}
