import { format } from "date-fns";
import { type Note } from "@shared/schema";
import NoteInput from "./NoteInput";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

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
        <h2 className="text-xl font-bold mb-2 text-black">{displayDate}</h2>
        
        {/* AI Analysis */}
        {isAnalysisLoading && (
          <div className="rounded-lg p-4 mb-4 shadow-md border border-green-100"
               style={{background: "linear-gradient(120deg, #f0fff5, #e5f7ef)"}}>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        
        {analysis && !isAnalysisLoading && (
          <div className="rounded-lg p-4 mb-4 shadow-md border border-green-200"
               style={{background: "linear-gradient(120deg, #f0fff5, #e5f7ef)"}}>
            <div className="flex justify-between items-center mb-1">
              <div className="font-medium text-black">Daily Analysis</div>
              {onRegenerateAnalysis && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-600 hover:text-green-800 hover:bg-green-100/50 -mr-1 rounded-full"
                  onClick={onRegenerateAnalysis}
                  title="Regenerate analysis"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-black">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
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
              <div key={note.id} className="note-card rounded-lg shadow-md p-4 transition-all duration-300 hover:shadow-lg border border-green-50">
                <div className="flex justify-between">
                  <div className="flex-1">
                    <p className="text-gray-800 mb-2">{note.content}</p>
                    <p className="text-sm text-green-600 font-medium">
                      {formatNoteTime(note.timestamp)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 h-8 w-8 -mt-1 -mr-2 rounded-full"
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
            <div className="rounded-lg shadow-md p-8 text-center" 
                 style={{background: "linear-gradient(135deg, #fff, #f3f4f6, #f0f9f5)"}}>
              <p className="font-semibold text-black text-lg">No notes for this day yet</p>
              <div className="max-w-md mx-auto mt-4 text-sm text-gray-600 space-y-3">
                <p className="border-b border-green-100 pb-2">Field Notes helps you record your daily observations with timestamped entries.</p>
                <p className="border-b border-green-100 pb-2">Add your first note using the form above. Each note can be up to 280 characters.</p>
                <p className="border-b border-green-100 pb-2">Use the calendar to navigate between days or click on recent days to quickly view your notes.</p>
                <p>After adding multiple notes, try the "Analyze My Day" feature to get AI-powered insights.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
