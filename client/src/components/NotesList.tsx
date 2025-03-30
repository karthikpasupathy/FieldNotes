import { format } from "date-fns";
import { type Note } from "@shared/schema";
import NoteInput from "./NoteInput";
import { Skeleton } from "@/components/ui/skeleton";

interface NotesListProps {
  notes: Note[];
  date: string;
  isLoading: boolean;
  displayDate: string;
}

export default function NotesList({ notes, date, isLoading, displayDate }: NotesListProps) {
  // Format the note timestamp for display
  const formatNoteTime = (timestamp: Date | string) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return format(date, "h:mm a");
  };
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">{displayDate}</h2>
        
        {/* New Note Form */}
        <NoteInput date={date} />
        
        {/* Notes List */}
        <div className="space-y-4">
          {isLoading ? (
            // Loading Skeletons
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-16 mt-4" />
                </div>
              ))}
            </>
          ) : notes.length > 0 ? (
            // Actual Notes
            notes.map((note) => (
              <div key={note.id} className="bg-white rounded-lg shadow-sm p-4 transition-all duration-300 hover:shadow-md">
                <p className="text-gray-800 mb-2">{note.content}</p>
                <p className="text-sm text-gray-500">{formatNoteTime(note.timestamp)}</p>
              </div>
            ))
          ) : (
            // Empty State
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500">No notes for this day yet</p>
              <p className="text-sm text-gray-400 mt-2">Add your first note above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
