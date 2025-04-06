import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Loader2, Sparkles, ArrowLeft, RefreshCw, BrainCircuit } from "lucide-react";
import { formatDateForDisplay } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { Note } from "@shared/schema";
import ReactMarkdown from "react-markdown";

export default function MomentsPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [selectedMomentId, setSelectedMomentId] = useState<number | null>(null);
  
  // Check for analyze parameter in URL
  const shouldAnalyze = location.includes('analyze=true');

  // Fetch all moments
  const { 
    data: moments = [] as Note[],
    isLoading: momentsLoading,
    error: momentsError 
  } = useQuery<Note[]>({
    queryKey: ["/api/moments"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch moments analysis
  const {
    data: momentsAnalysis = { analysis: "" },
    isLoading: analysisLoading,
    error: analysisError,
    refetch: refetchAnalysis
  } = useQuery<{ analysis: string }>({
    queryKey: ["/api/analyze-moments"],
    enabled: false, // Don't run automatically, only when the user clicks the analyze button
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
  
  // We're no longer auto-triggering analysis, only doing it on user request

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
      // Invalidate all related caches to refresh them properly
      queryClient.invalidateQueries({ queryKey: ["/api/moments"] });
      // Also invalidate the daily notes queries
      const moment = moments.find(m => m.id === data.noteId);
      if (moment) {
        queryClient.invalidateQueries({ queryKey: [`/api/notes/${moment.date}`] });
      }
      
      // Use the isNowMoment property from the response
      const isNowMoment = data.isNowMoment;
      
      toast({
        title: isNowMoment ? "Moment Added" : "Moment Removed",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Group moments by date
  type MomentsByDateType = { [date: string]: Note[] };
  const momentsByDate = moments.reduce<MomentsByDateType>((acc, moment) => {
    if (!acc[moment.date]) {
      acc[moment.date] = [];
    }
    acc[moment.date].push(moment);
    return acc;
  }, {});

  // Sort dates in reverse chronological order
  const sortedDates = Object.keys(momentsByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const handleRegenerateAnalysis = () => {
    refetchAnalysis();
    toast({
      title: "Regenerating analysis",
      description: "Please wait while we analyze your moments",
    });
  };

  // Handle moment selection for mobile view
  const handleMomentClick = (momentId: number) => {
    if (isMobile) {
      setSelectedMomentId(selectedMomentId === momentId ? null : momentId);
    }
  };

  if (momentsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2">Loading your moments...</p>
      </div>
    );
  }

  if (momentsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-destructive text-lg font-semibold">
          Error loading moments: {momentsError.message}
        </p>
        <Button asChild className="mt-4">
          <Link href="/">Go Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        {isMobile ? (
          <>
            <Button variant="ghost" size="sm" asChild className="p-0 mr-2">
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold flex items-center grow">
              <img src="/icons/daynotes-logo.png" alt="Daynotes Logo" className="h-8 w-8 mr-2" />
              Moments
            </h1>
            {moments.length > 0 && (
              <Button 
                variant="ghost"
                size="sm"
                onClick={handleRegenerateAnalysis}
                disabled={analysisLoading}
                className="p-1 ml-2"
              >
                <BrainCircuit className="h-5 w-5 text-blue-600" />
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center">
              <Button variant="ghost" size="sm" asChild className="mr-2">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <h1 className="text-2xl font-bold flex items-center">
                <img src="/icons/daynotes-logo.png" alt="Daynotes Logo" className="h-8 w-8 mr-2" />
                Moments
              </h1>
            </div>
            {moments.length > 0 && (
              <Button 
                variant="outline"
                size="sm"
                onClick={handleRegenerateAnalysis}
                disabled={analysisLoading}
                className="flex items-center"
              >
                <div className="flex items-center justify-center h-4 w-4 mr-2">
                  <BrainCircuit className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span>Analyze Moments</span>
              </Button>
            )}
          </>
        )}
      </div>

      {moments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/20">
          <div className="flex items-center justify-center h-12 w-12 mb-4 bg-yellow-400 text-white rounded-sm">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No moments yet</h2>
          <p className="text-center mb-4">
            Mark your most meaningful notes as moments by clicking the moment icon.
          </p>
          <Button asChild>
            <Link href="/">Go to Notes</Link>
          </Button>
        </div>
      ) : isMobile ? (
        // Mobile layout - Analysis at the top, collapsible
        <div className="space-y-4">
          {/* Analysis Card - Mobile */}
          <Card className={selectedMomentId ? "hidden" : ""}>
            <CardHeader className="py-3 px-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="analysis" className="border-none">
                  <AccordionTrigger className="py-0 hover:no-underline">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center">
                        <BrainCircuit className="h-4 w-4 mr-2 text-blue-600" />
                        Moments Analysis
                      </span>
                    </CardTitle>
                  </AccordionTrigger>
                  <AccordionContent>
                    {analysisLoading ? (
                      <div className="flex flex-col items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary mb-2" />
                        <p className="text-sm text-center">Analyzing your moments...</p>
                      </div>
                    ) : analysisError ? (
                      <div className="py-2 text-center">
                        <p className="text-destructive text-sm mb-2">Failed to analyze moments</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRegenerateAnalysis}
                        >
                          Try Again
                        </Button>
                      </div>
                    ) : momentsAnalysis?.analysis ? (
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert mt-2">
                        <ReactMarkdown>{momentsAnalysis.analysis}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-3 text-sm">
                        Click the analyze button to generate insights from your moments.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardHeader>
          </Card>

          {/* Moments List - Mobile */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center">
                <div className="flex items-center justify-center h-4 w-4 mr-2 bg-yellow-400 text-white rounded-sm">
                  <Sparkles className="h-3 w-3" />
                </div>
                Your Moments
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-2">
              {sortedDates.map(date => (
                <div key={date} className="mb-4">
                  <h3 className="text-sm font-semibold mb-2 pb-1 border-b border-muted">
                    {formatDateForDisplay(new Date(date))}
                  </h3>
                  {momentsByDate[date].map(moment => (
                    <div 
                      key={moment.id} 
                      className={`mb-3 p-3 rounded-lg border ${
                        selectedMomentId === moment.id ? 'border-yellow-400 bg-yellow-50' : 'border-border'
                      } hover:border-yellow-300 transition-colors cursor-pointer`}
                      onClick={() => handleMomentClick(moment.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="text-xs text-muted-foreground">
                          {new Date(moment.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMomentMutation.mutate(moment.id);
                          }}
                          className="h-7 w-7 p-0"
                          title="Remove from moments"
                        >
                          <div className="flex items-center justify-center h-4 w-4 bg-yellow-400 text-white rounded-sm">
                            <Sparkles className="h-3 w-3" />
                          </div>
                        </Button>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{moment.content}</p>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        // Desktop layout - Side-by-side
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="flex items-center justify-center h-5 w-5 mr-2 bg-yellow-400 text-white rounded-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  Your Moments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-240px)]">
                  {sortedDates.map(date => (
                    <div key={date} className="mb-6">
                      <h3 className="text-md font-semibold mb-2 pb-1 border-b border-muted">
                        {formatDateForDisplay(new Date(date))}
                      </h3>
                      {momentsByDate[date].map(moment => (
                        <div 
                          key={moment.id} 
                          className={`mb-4 p-4 rounded-lg border ${
                            selectedMomentId === moment.id ? 'border-yellow-400 bg-yellow-50' : 'border-border'
                          } hover:border-yellow-300 transition-colors cursor-pointer`}
                          onClick={() => handleMomentClick(moment.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="text-sm text-muted-foreground">
                              {new Date(moment.timestamp).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMomentMutation.mutate(moment.id);
                              }}
                              className="h-8 w-8 p-0"
                              title="Remove from moments"
                            >
                              <div className="flex items-center justify-center h-4 w-4 bg-yellow-400 text-white rounded-sm">
                                <Sparkles className="h-3 w-3" />
                              </div>
                            </Button>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap">{moment.content}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Moments Analysis</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRegenerateAnalysis}
                    disabled={analysisLoading || moments.length === 0}
                  >
                    <RefreshCw className={`h-4 w-4 ${analysisLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-240px)]">
                  {analysisLoading ? (
                    <div className="flex flex-col items-center justify-center p-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                      <p className="text-sm text-center">Analyzing your moments...</p>
                    </div>
                  ) : analysisError ? (
                    <div className="p-4 text-center">
                      <p className="text-destructive mb-2">Failed to analyze moments</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRegenerateAnalysis}
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : momentsAnalysis?.analysis ? (
                    <Accordion type="single" collapsible defaultValue="analysis" className="w-full">
                      <AccordionItem value="analysis">
                        <AccordionTrigger className="font-semibold">Patterns & Insights</AccordionTrigger>
                        <AccordionContent>
                          <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{momentsAnalysis.analysis}</ReactMarkdown>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : (
                    <p className="text-center text-muted-foreground p-4">
                      {moments.length > 0 
                        ? "Click the refresh button to generate an analysis of your moments."
                        : "Mark some notes as moments to see an analysis here."}
                    </p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}