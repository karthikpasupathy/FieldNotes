import { format } from "date-fns";
import { type Note } from "@shared/schema";
import NoteInput from "./NoteInput";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NotesListProps {
  notes: Note[];
  date: string;
  isLoading: boolean;
  displayDate: string;
  analysis?: string;
  isAnalysisLoading?: boolean;
  onRegenerateAnalysis?: () => void;
}

export default function NotesList({ 
  notes, 
  date, 
  isLoading, 
  displayDate,
  analysis,
  isAnalysisLoading = false,
  onRegenerateAnalysis
}: NotesListProps) {
  const { toast } = useToast();
  
  // Format the note timestamp for display
  const formatNoteTime = (timestamp: Date | string) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return format(date, "h:mm a");
  };
  
  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      // Refresh the notes list
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${date}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/recent-days'] });
      
      toast({
        title: "Note Deleted",
        description: "Your note has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete note: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">{displayDate}</h2>
        
        {/* AI Analysis */}
        {isAnalysisLoading && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        
        {analysis && !isAnalysisLoading && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100">
            <div className="flex justify-between items-center mb-1">
              <p className="text-blue-800 font-medium">Daily Analysis</p>
              {onRegenerateAnalysis && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100 -mr-1"
                  onClick={onRegenerateAnalysis}
                  title="Regenerate analysis"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="text-blue-700">{analysis}</p>
          </div>
        )}
        
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
                <div className="flex justify-between">
                  <div className="flex-1">
                    <p className="text-gray-800 mb-2">{note.content}</p>
                    <p className="text-sm text-gray-500">{formatNoteTime(note.timestamp)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-red-500 transition-colors h-8 w-8 -mt-1 -mr-2"
                    onClick={() => deleteNoteMutation.mutate(note.id)}
                    disabled={deleteNoteMutation.isPending}
                    title="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            // Empty State
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-600 font-medium">No notes for this day yet</p>
              <div className="max-w-md mx-auto mt-4 text-sm text-gray-500 space-y-3">
                <p>Field Notes helps you record your daily observations with timestamped entries.</p>
                <p>Add your first note using the form above. Each note can be up to 280 characters.</p>
                <p>Use the calendar to navigate between days or click on recent days to quickly view your notes.</p>
                <p>After adding multiple notes, try the "Analyze My Day" feature to get AI-powered insights.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
