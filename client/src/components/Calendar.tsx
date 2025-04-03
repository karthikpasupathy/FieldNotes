import { useState } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths,
  parseISO,
  isValid,
  formatISO
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  highlightedDates?: string[];
}

export default function Calendar({ 
  currentDate, 
  onSelectDate, 
  highlightedDates = [] 
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(currentDate));
  
  // Generate days for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate where to start the calendar (to align with week days)
  const startDay = monthStart.getDay(); // 0 for Sunday, 1 for Monday, etc.
  
  // Handle month navigation
  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  // Check if a date has notes (is highlighted)
  const hasNotes = (date: Date): boolean => {
    if (!highlightedDates || highlightedDates.length === 0) return false;
    
    const dateString = formatISO(date, { representation: 'date' });
    return highlightedDates.includes(dateString);
  };
  
  return (
    <div className="calendar">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-1 h-7 w-7" 
          onClick={goToPreviousMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-1 h-7 w-7" 
          onClick={goToNextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Days of Week */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 mb-1">
        <div>Su</div>
        <div>Mo</div>
        <div>Tu</div>
        <div>We</div>
        <div>Th</div>
        <div>Fr</div>
        <div>Sa</div>
      </div>
      
      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1 text-sm">
        {/* Empty cells for days before the start of the month */}
        {Array.from({ length: startDay }).map((_, index) => (
          <div key={`empty-${index}`} className="w-8 h-8" />
        ))}
        
        {/* Actual month days */}
        {monthDays.map((day) => {
          const isSelected = isSameDay(day, currentDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const dayHasNotes = hasNotes(day);
          
          return (
            <div key={day.toString()} className="relative w-8 h-8 flex items-center justify-center">
              <Button
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className={`w-8 h-8 rounded-full p-0 ${
                  isSelected 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "hover:bg-muted"
                } ${!isCurrentMonth ? "text-muted-foreground" : ""}`}
                onClick={() => onSelectDate(day)}
              >
                {format(day, "d")}
              </Button>
              
              {/* Indicator dot for days with notes */}
              {dayHasNotes && isCurrentMonth && (
                <div 
                  className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full ${
                    isSelected ? "bg-yellow-300" : "bg-yellow-400"
                  }`}
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
