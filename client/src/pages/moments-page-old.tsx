import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Loader2, Sparkles, ArrowLeft, RefreshCw, BrainCircuit, Star, Heart, Zap } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 max-w-6xl">
          <div className="flex justify-between items-center">
            {isMobile ? (
              <>
                <Button variant="ghost" size="sm" asChild className="p-2 hover:bg-slate-100 rounded-xl">
                  <Link href="/">
                    <ArrowLeft className="h-5 w-5 text-slate-600" />
                  </Link>
                </Button>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                    Moments
                  </h1>
                </div>
                {moments.length > 0 && (
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateAnalysis}
                    disabled={analysisLoading}
                    className="p-2 hover:bg-blue-100 rounded-xl"
                  >
                    <BrainCircuit className="h-5 w-5 text-blue-600" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center space-x-4">
                  <Button variant="ghost" size="sm" asChild className="hover:bg-slate-100 rounded-xl">
                    <Link href="/">
                      <ArrowLeft className="h-4 w-4 mr-2 text-slate-600" />
                      <span className="text-slate-600">Back</span>
                    </Link>
                  </Button>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                        Moments
                      </h1>
                      <p className="text-sm text-slate-500 mt-1">Your most meaningful notes</p>
                    </div>
                  </div>
                </div>
                {moments.length > 0 && (
                  <Button 
                    onClick={handleRegenerateAnalysis}
                    disabled={analysisLoading}
                    className="btn-modern flex items-center space-x-2"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    <span>Analyze Moments</span>
                    {analysisLoading && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {moments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            {/* Beautiful Empty State */}
            <div className="text-center max-w-md mx-auto">
              <div className="relative mb-8">
                <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-4 shadow-lg">
                  <Sparkles className="h-12 w-12 text-amber-500" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <Star className="h-4 w-4 text-white" />
                </div>
                <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-red-500 flex items-center justify-center">
                  <Heart className="h-3 w-3 text-white" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-3">
                No moments yet
              </h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Start capturing your most meaningful thoughts and memories. 
                Click the sparkle icon on any note to mark it as a special moment.
              </p>
              
              <div className="space-y-3">
                <Button asChild className="btn-modern w-full">
                  <Link href="/">
                    <Zap className="h-4 w-4 mr-2" />
                    Start Writing Notes
                  </Link>
                </Button>
                <p className="text-xs text-slate-400">
                  Pro tip: Your moments will help you track patterns and insights over time
                </p>
              </div>
            </div>
          </div>
        ) : isMobile ? (
          // Mobile layout with modern design
          <div className="space-y-6">
            {/* Analysis Card - Mobile */}
            <div className={`modern-card ${selectedMomentId ? "hidden" : ""}`}>
              <div className="p-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="analysis" className="border-none">
                    <AccordionTrigger className="py-0 hover:no-underline">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <BrainCircuit className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-slate-800">Moments Analysis</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4">
                      {analysisLoading ? (
                        <div className="analysis-box-modern">
                          <div className="flex flex-col items-center justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-3" />
                            <p className="text-slate-600">Analyzing your moments...</p>
                          </div>
                        </div>
                      ) : analysisError ? (
                        <div className="analysis-box-modern">
                          <div className="text-center py-4">
                            <p className="text-red-600 mb-3">Failed to analyze moments</p>
                            <Button 
                              onClick={handleRegenerateAnalysis}
                              className="btn-modern-secondary"
                            >
                              Try Again
                            </Button>
                          </div>
                        </div>
                      ) : momentsAnalysis?.analysis ? (
                        <div className="analysis-box-modern">
                          <div className="prose prose-sm max-w-none text-slate-700">
                            <ReactMarkdown>{momentsAnalysis.analysis}</ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        <div className="analysis-box-modern">
                          <p className="text-center text-slate-500 py-4">
                            Click the analyze button to generate insights from your moments.
                          </p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>

            {/* Moments List - Mobile */}
            <div className="modern-card">
              <div className="p-4 border-b border-slate-200/60">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800">Your Moments</h2>
                    <p className="text-xs text-slate-500">{moments.length} moment{moments.length !== 1 ? 's' : ''} captured</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-6">
                {sortedDates.map(date => (
                  <div key={date} className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-600 pb-2 border-b border-slate-100">
                      {formatDateForDisplay(new Date(date))}
                    </h3>
                    {momentsByDate[date].map(moment => (
                      <div key={moment.id} className="moment-card cursor-pointer" onClick={() => handleMomentClick(moment.id)}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="text-xs text-slate-500 font-medium">
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
                            className="h-8 w-8 p-0 hover:bg-amber-100 rounded-lg"
                            title="Remove from moments"
                          >
                            <Sparkles className="h-4 w-4 text-amber-500" />
                          </Button>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{moment.content}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
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