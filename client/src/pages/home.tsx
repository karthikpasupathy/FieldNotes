import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parse, addDays, subDays } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  List, 
  Settings, 
  Download, 
  User as UserIcon,
  BrainCircuit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import NotesList from "@/components/NotesList";
import Calendar from "@/components/Calendar";
import RecentDays from "@/components/RecentDays";
import UserProfile from "@/components/UserProfile";
import { formatDateForDisplay, formatDateForAPI } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Note } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const [, setLocation] = useLocation();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [match, params] = useRoute("/day/:date");
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Get current date from URL or use today's date
  const today = formatDateForAPI(new Date());
  const currentDate = match ? params.date : today;
  
  // Convert currentDate string to Date object for manipulation
  const currentDateObj = match && params.date ? 
    parse(params.date, "yyyy-MM-dd", new Date()) : 
    new Date();

  // Fetch notes for the current date
  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: [`/api/notes/${currentDate}`],
  });

  // Fetch recent days with note counts
  const { data: recentDays = [] } = useQuery<{ date: string; count: number }[]>({
    queryKey: ['/api/recent-days'],
  });
  
  // Fetch dates with notes for calendar indicators
  const { data: datesWithNotes = [] } = useQuery<string[]>({
    queryKey: ['/api/dates-with-notes'],
  });
  
  // Query for AI analysis of notes
  const { 
    data: analysisData, 
    isLoading: isAnalysisLoading, 
    refetch: refetchAnalysis,
    isFetching: isAnalysisFetching 
  } = useQuery<{ analysis: string }>({
    queryKey: [`/api/analyze/${currentDate}`],
    enabled: false, // Don't run this query automatically
  });
  
  // Function to force regenerate analysis
  const regenerateAnalysis = async () => {
    try {
      toast({
        title: "Regenerating analysis",
        description: "Using AI to reanalyze your notes for the day..."
      });
      
      // Make a direct fetch with regenerate=true parameter
      const response = await fetch(`/api/analyze/${currentDate}?regenerate=true`);
      if (!response.ok) {
        throw new Error('Failed to regenerate analysis');
      }
      
      const data = await response.json();
      
      // Update the query cache with the new analysis
      queryClient.setQueryData([`/api/analyze/${currentDate}`], data);
      
      toast({
        title: "Analysis regenerated",
        description: "Your notes have been reanalyzed with the latest entries!"
      });
    } catch (error) {
      console.error("Error regenerating analysis:", error);
      toast({
        title: "Regeneration failed",
        description: "There was an error regenerating your analysis. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle calendar toggle
  const toggleCalendar = () => {
    setIsCalendarOpen(!isCalendarOpen);
  };

  // Handle date navigation
  const goToNextDay = () => {
    const nextDate = formatDateForAPI(addDays(currentDateObj, 1));
    setLocation(`/day/${nextDate}`);
  };

  const goToPreviousDay = () => {
    const prevDate = formatDateForAPI(subDays(currentDateObj, 1));
    setLocation(`/day/${prevDate}`);
  };

  const goToDate = (date: Date) => {
    const formattedDate = formatDateForAPI(date);
    setLocation(`/day/${formattedDate}`);
    setIsCalendarOpen(false);
  };
  
  // Handle export notes as markdown
  const exportNotesAsMarkdown = () => {
    if (notes.length === 0) {
      toast({
        title: "No notes to export",
        description: "There are no notes available for this date to export.",
        variant: "destructive",
      });
      return;
    }
    
    // Format the notes into markdown
    const displayDate = formatDateForDisplay(currentDateObj);
    let markdown = `# Field Notes: ${displayDate}\n\n`;
    
    notes.forEach(note => {
      const noteTime = new Date(note.timestamp).toLocaleTimeString();
      markdown += `## ${noteTime}\n\n${note.content}\n\n`;
    });
    
    // Create a blob and download it
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field-notes-${currentDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Notes exported",
      description: `Notes for ${displayDate} have been exported as markdown.`,
    });
  };
  
  // Handle analyzing notes with AI
  const analyzeNotes = async () => {
    if (notes.length === 0) {
      toast({
        title: "No notes to analyze",
        description: "There are no notes available for this date to analyze.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      toast({
        title: "Analyzing notes",
        description: "Using AI to analyze your notes for the day...",
      });
      
      await refetchAnalysis();
      
      toast({
        title: "Analysis complete",
        description: "Your notes have been analyzed!",
      });
    } catch (error) {
      console.error("Error analyzing notes:", error);
      toast({
        title: "Analysis failed",
        description: "There was an error analyzing your notes. Please try again.",
        variant: "destructive",
      });
    }
  };

  // If URL has no date parameter, redirect to today's date
  useEffect(() => {
    if (!match) {
      setLocation(`/day/${today}`);
    }
  }, [match, setLocation, today]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-bold text-gray-800 flex items-center">
              <span className="mr-2">📝</span> Field Notes
            </h1>
            
            <div className="flex items-center space-x-4">
              {/* Date Navigation */}
              <div className="flex items-center space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full p-2" 
                  onClick={goToPreviousDay}
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1"
                  onClick={toggleCalendar}
                >
                  <span>{formatDateForDisplay(currentDateObj)}</span>
                  <CalendarIcon className="h-4 w-4 ml-1" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full p-2" 
                  onClick={goToNextDay}
                >
                  <ArrowRightIcon className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Analyze Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={analyzeNotes}
                title="Analyze My Day"
                className="hidden sm:flex"
                disabled={isAnalysisFetching || notes.length === 0}
              >
                <BrainCircuit className="h-4 w-4 mr-1" />
                <span className="sr-only sm:not-sr-only">
                  {isAnalysisFetching ? "Analyzing..." : "Analyze"}
                </span>
              </Button>
              
              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={exportNotesAsMarkdown}
                title="Export as Markdown"
                className="hidden sm:flex"
              >
                <Download className="h-4 w-4 mr-1" />
                <span className="sr-only sm:not-sr-only">Export</span>
              </Button>
              
              {/* User Profile */}
              <UserProfile />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex flex-col md:flex-row h-full">
            
            {/* Left sidebar for desktop */}
            <div className="hidden md:block md:w-64 pt-6 pr-6">
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800">Calendar</h2>
                </div>
                <Calendar 
                  currentDate={currentDateObj} 
                  onSelectDate={goToDate}
                  highlightedDates={datesWithNotes}
                />
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h2 className="font-semibold text-gray-800 mb-2">Recent Days</h2>
                <RecentDays 
                  days={recentDays} 
                  currentDate={currentDate} 
                  onSelectDate={(date) => setLocation(`/day/${date}`)} 
                />
              </div>
            </div>
              
            {/* Main content area */}
            <div className="flex-1 pt-6 pb-24 md:pb-6 overflow-auto md:h-[calc(100vh-80px)]">
              {/* Mobile Calendar (Collapsible) */}
              {isCalendarOpen && (
                <div className="md:hidden transition-all duration-300 mb-4">
                  <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                    <Calendar 
                      currentDate={currentDateObj} 
                      onSelectDate={goToDate}
                      highlightedDates={datesWithNotes}
                    />
                  </div>
                </div>
              )}
              
              <NotesList 
                notes={notes} 
                date={currentDate} 
                isLoading={isLoading} 
                displayDate={formatDateForDisplay(currentDateObj)}
                analysis={analysisData?.analysis}
                isAnalysisLoading={isAnalysisFetching}
                onRegenerateAnalysis={regenerateAnalysis}
              />
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile bottom navigation */}
      <nav className="md:hidden bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-10">
        <div className="max-w-md mx-auto px-4 flex justify-between">
          <button className="flex flex-col items-center py-3 px-4 text-blue-600">
            <List className="h-5 w-5" />
            <span className="text-xs mt-1">Notes</span>
          </button>
          <button 
            className="flex flex-col items-center py-3 px-4 text-gray-500"
            onClick={toggleCalendar}
          >
            <CalendarIcon className="h-5 w-5" />
            <span className="text-xs mt-1">Calendar</span>
          </button>
          <button 
            className="flex flex-col items-center py-3 px-4 text-gray-500"
            onClick={analyzeNotes}
            disabled={isAnalysisFetching || notes.length === 0}
          >
            <BrainCircuit className="h-5 w-5" />
            <span className="text-xs mt-1">Analyze</span>
          </button>
          <button 
            className="flex flex-col items-center py-3 px-4 text-gray-500"
            onClick={() => setLocation('/profile')}
          >
            <UserIcon className="h-5 w-5" />
            <span className="text-xs mt-1">Profile</span>
          </button>
          <button 
            className="flex flex-col items-center py-3 px-4 text-gray-500"
            onClick={exportNotesAsMarkdown}
          >
            <Download className="h-5 w-5" />
            <span className="text-xs mt-1">Export</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
