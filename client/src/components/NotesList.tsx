import { format } from "date-fns";
import { type Note } from "@shared/schema";
import NoteInput from "./NoteInput";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { Link } from "wouter";

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
      queryClient.invalidateQueries({ queryKey: ['/api/moments'] });
      
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
  
  // Toggle moment status mutation
  const toggleMomentMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const response = await fetch(`/api/moments/${noteId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to toggle moment status");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refresh the notes list and moments
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${date}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/moments'] });
      
      toast({
        title: "Moment Updated",
        description: "Your note has been marked as a special moment.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
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
          <div className="analysis-box">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        
        {analysis && !isAnalysisLoading && (
          <div className="analysis-box">
            <div className="analysis-box-header">
              <div className="analysis-box-title">Daily Analysis</div>
              {onRegenerateAnalysis && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 -mr-1 rounded-full"
                  onClick={onRegenerateAnalysis}
                  title="Regenerate analysis"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="analysis-content">
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
              <div 
                key={note.id} 
                className={`note-card rounded-lg shadow-md p-4 transition-all duration-300 hover:shadow-lg border ${
                  note.isMoment ? 'border-yellow-200 bg-yellow-50/30' : 'border-blue-50'
                }`}
              >
                <div className="flex justify-between">
                  <div className="flex-1">
                    <p className="text-gray-800 mb-2">{note.content}</p>
                    <div className="flex items-center">
                      <p className="text-sm text-blue-600 font-medium">
                        {formatNoteTime(note.timestamp)}
                      </p>
                      {note.isMoment && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Special Moment
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`transition-all duration-200 h-8 w-8 -mt-1 rounded-full ${
                        note.isMoment 
                          ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50' 
                          : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                      }`}
                      onClick={() => toggleMomentMutation.mutate(note.id)}
                      disabled={toggleMomentMutation.isPending}
                      title={note.isMoment ? "Remove from moments" : "Mark as special moment"}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 h-8 w-8 -mt-1 rounded-full"
                      onClick={() => deleteNoteMutation.mutate(note.id)}
                      disabled={deleteNoteMutation.isPending}
                      title="Delete note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            // Empty State
            <div className="rounded-lg shadow-md p-8 text-center" 
                 style={{background: "linear-gradient(135deg, #fff, #f7f9fd, #eaf0f9)"}}>
              <p className="font-semibold text-blue-900 text-lg">No notes for this day yet</p>
              <div className="max-w-md mx-auto mt-4 text-sm text-gray-600 space-y-3">
                <p className="border-b border-blue-100 pb-2">Daynotes helps you record your daily observations with timestamped entries.</p>
                <p className="border-b border-blue-100 pb-2">Add your first note using the form above. Each note can be up to 280 characters.</p>
                <p className="border-b border-blue-100 pb-2">Use the calendar to navigate between days or click on recent days to quickly view your notes.</p>
                <p>After adding multiple notes, try the "Analyze My Day" feature to get AI-powered insights.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
