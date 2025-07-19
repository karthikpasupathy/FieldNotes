import { format } from "date-fns";
import { type Note } from "@shared/schema";
import NoteInput from "./NoteInput";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, RefreshCw, Sparkles, BrainCircuit } from "lucide-react";
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
    onSuccess: (data) => {
      // Refresh the notes list and moments
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${date}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/moments'] });
      
      // Use the isNowMoment property from the response
      const isNowMoment = data.isNowMoment;
      
      toast({
        title: isNowMoment ? "Moment Added" : "Moment Removed",
        description: isNowMoment 
          ? "Your note has been marked as a moment." 
          : "Your note is no longer marked as a moment.",
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
        
        {/* AI Analysis - Modern */}
        {isAnalysisLoading && (
          <div className="analysis-box-modern mb-6">
            <div className="loading-modern h-4 w-full mb-3 rounded"></div>
            <div className="loading-modern h-4 w-3/4 mb-3 rounded"></div>
            <div className="loading-modern h-4 w-1/2 rounded"></div>
          </div>
        )}
        
        {analysis && !isAnalysisLoading && (
          <div className="analysis-box-modern mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <BrainCircuit className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-slate-800">Daily Analysis</span>
              </div>
              {onRegenerateAnalysis && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-blue-100 rounded-xl"
                  onClick={onRegenerateAnalysis}
                  title="Regenerate analysis"
                >
                  <RefreshCw className="h-4 w-4 text-blue-600" />
                </Button>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-slate-700">
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
            // Actual Notes with modern styling
            notes.map((note) => (
              <div 
                key={note.id} 
                className={note.isMoment ? 'moment-card' : 'note-card-modern'}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-3">
                    <p className="text-slate-700 mb-3 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center space-x-3">
                      <p className="text-sm text-slate-500 font-medium">
                        {formatNoteTime(note.timestamp)}
                      </p>
                      {note.isMoment && (
                        <span className="text-xs bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 px-3 py-1 rounded-full flex items-center font-medium border border-amber-200">
                          <Sparkles className="h-3 w-3 mr-1.5" />
                          Moment
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-9 w-9 p-0 rounded-xl transition-all duration-200 ${
                        note.isMoment 
                          ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-100' 
                          : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                      onClick={() => toggleMomentMutation.mutate(note.id)}
                      disabled={toggleMomentMutation.isPending}
                      title={note.isMoment ? "Remove from moments" : "Mark as special moment"}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
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
            // Modern Empty State
            <div className="modern-card p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-300 to-slate-400"></div>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">No notes for this day yet</h3>
                <div className="text-sm text-slate-600 space-y-3">
                  <p className="pb-3 border-b border-slate-100">Start capturing your thoughts and observations above.</p>
                  <p className="pb-3 border-b border-slate-100">Each note can be up to 280 characters and gets automatically timestamped.</p>
                  <p className="pb-3 border-b border-slate-100">Use the calendar to navigate between days or explore recent entries.</p>
                  <p>After adding multiple notes, try the "Analyze My Day" feature for AI insights.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
