import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Note } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';

interface TimelineSectionProps {
  title: string;
  date: string;
  formattedDate: string;
  notes: Note[];
  onViewDay: (date: string) => void;
}

function TimelineSection({ title, date, formattedDate, notes, onViewDay }: TimelineSectionProps) {
  if (notes.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-2">{formattedDate}</p>
        <p className="text-gray-500 italic">No notes on this day.</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 mb-2">{formattedDate}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onViewDay(date)}
          className="text-xs"
        >
          <Calendar className="h-3 w-3 mr-1" />
          View Day
        </Button>
      </div>
      
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="p-3 bg-gray-50 rounded-md">
            <div className="flex items-center text-xs text-gray-500 mb-1">
              <Clock className="h-3 w-3 mr-1" />
              {format(new Date(note.timestamp), 'h:mm a')}
              {note.isMoment && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Moment
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface OnThisDayResponse {
  weekAgo: {
    date: string;
    notes: Note[];
    formattedDate: string;
  };
  monthAgo: {
    date: string;
    notes: Note[];
    formattedDate: string;
  };
  yearAgo: {
    date: string;
    notes: Note[];
    formattedDate: string;
  };
}

export default function OnThisDay({ currentDate }: { currentDate: string }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<OnThisDayResponse>({
    queryKey: ["/api/on-this-day", currentDate],
    queryFn: async () => {
      const response = await fetch(`/api/on-this-day?date=${currentDate}`);
      if (!response.ok) {
        throw new Error("Failed to fetch on this day data");
      }
      return response.json();
    },
    // Only fetch when dialog is open
    enabled: open,
  });

  const handleViewDay = (date: string) => {
    setOpen(false);
    setLocation(`/day/${date}`);
  };

  const hasAnyNotes = data && (
    data.weekAgo.notes.length > 0 || 
    data.monthAgo.notes.length > 0 || 
    data.yearAgo.notes.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          id="on-this-day-trigger"
          variant="outline" 
          size="sm"
          title="On This Day"
          className="hidden sm:flex text-black bg-white border-blue-500 hover:bg-white hover:text-black"
        >
          <History className="h-4 w-4" />
          <span className="sr-only">On This Day</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>On This Day</DialogTitle>
          <DialogDescription>
            See what you wrote on this day in previous weeks, months, and years.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-3 text-gray-500">Loading memories...</p>
          </div>
        ) : error ? (
          <div className="py-10 text-center text-red-500">
            <p>Something went wrong while fetching your memories.</p>
          </div>
        ) : !hasAnyNotes ? (
          <div className="py-10 text-center text-gray-500">
            <History className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No previous notes found for this day.</p>
            <p className="text-sm mt-2">As you use Daynotes more, memories will appear here.</p>
          </div>
        ) : (
          <div className="mt-3">
            <TimelineSection 
              title="Last Week" 
              date={data.weekAgo.date}
              formattedDate={data.weekAgo.formattedDate}
              notes={data.weekAgo.notes}
              onViewDay={handleViewDay}
            />
            
            <Separator className="my-4" />
            
            <TimelineSection 
              title="Last Month" 
              date={data.monthAgo.date}
              formattedDate={data.monthAgo.formattedDate}
              notes={data.monthAgo.notes}
              onViewDay={handleViewDay}
            />
            
            <Separator className="my-4" />
            
            <TimelineSection 
              title="Last Year" 
              date={data.yearAgo.date}
              formattedDate={data.yearAgo.formattedDate}
              notes={data.yearAgo.notes}
              onViewDay={handleViewDay}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}