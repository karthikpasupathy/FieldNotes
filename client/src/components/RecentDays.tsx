import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";

interface RecentDaysProps {
  days: { date: string; count: number }[];
  currentDate: string;
  onSelectDate: (date: string) => void;
}

export default function RecentDays({ days, currentDate, onSelectDate }: RecentDaysProps) {
  // Format date for display
  const formatDay = (date: string) => {
    const parsedDate = parse(date, "yyyy-MM-dd", new Date());
    return format(parsedDate, "MMM d, yyyy");
  };
  
  return (
    <ul className="space-y-1">
      {days.length > 0 ? (
        days.map((day) => (
          <li key={day.date}>
            <Button
              variant="ghost"
              className={`w-full text-left py-2 px-3 rounded justify-start h-auto ${
                day.date === currentDate ? "bg-blue-50" : ""
              }`}
              onClick={() => onSelectDate(day.date)}
            >
              <span className="mr-1">{formatDay(day.date)}</span>
              <span className="ml-2 text-gray-500 text-xs">
                {day.count} {day.count === 1 ? "note" : "notes"}
              </span>
            </Button>
          </li>
        ))
      ) : (
        <li>
          <p className="text-sm text-gray-500 p-2">No recent days with notes</p>
        </li>
      )}
    </ul>
  );
}
