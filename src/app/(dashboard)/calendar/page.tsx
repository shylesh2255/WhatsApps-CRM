"use client";

import { useAuth } from "@/hooks/use-auth";
import { CalendarView } from "@/components/calendar/calendar-view";

export default function CalendarPage() {
  const { account } = useAuth();

  if (!account) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-2">
          Meetings, calls, follow-ups and reminders
        </p>
      </div>

      <CalendarView />
    </div>
  );
}
