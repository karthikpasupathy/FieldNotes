import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateForAPI } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useIsMobile } from "@/hooks/use-mobile";

type PeriodType = "week" | "month";

interface PeriodAnalysisProps {
  currentDate: Date;
}

export default function PeriodAnalysis({ currentDate }: PeriodAnalysisProps) {
  const [activeTab, setActiveTab] = useState<PeriodType>("week");
  const [isOpen, setIsOpen] = useState(true);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Get the date ranges for week and month
  const weekStart = formatDateForAPI(startOfWeek(currentDate, { weekStartsOn: 1 }));
  const weekEnd = formatDateForAPI(endOfWeek(currentDate, { weekStartsOn: 1 }));
  const monthStart = formatDateForAPI(startOfMonth(currentDate));
  const monthEnd = formatDateForAPI(endOfMonth(currentDate));

  // Format date ranges for display
  const weekRangeDisplay = `${format(parseISO(weekStart), 'MMM d')} - ${format(parseISO(weekEnd), 'MMM d, yyyy')}`;
  const monthRangeDisplay = format(parseISO(monthStart), 'MMMM yyyy');

  // Query for weekly analysis
  const {
    data: weeklyAnalysis,
    isLoading: isWeeklyLoading,
    isFetching: isWeeklyFetching,
    refetch: refetchWeekly
  } = useQuery<{ analysis: string }>({
    queryKey: ['/api/analyze-period', weekStart, weekEnd, 'week'],
    enabled: false,
  });

  // Query for monthly analysis
  const {
    data: monthlyAnalysis,
    isLoading: isMonthlyLoading,
    isFetching: isMonthlyFetching,
    refetch: refetchMonthly
  } = useQuery<{ analysis: string }>({
    queryKey: ['/api/analyze-period', monthStart, monthEnd, 'month'],
    enabled: false,
  });

  // Function to analyze the current period
  const analyzePeriod = async (periodType: PeriodType) => {
    try {
      const startDate = periodType === 'week' ? weekStart : monthStart;
      const endDate = periodType === 'week' ? weekEnd : monthEnd;
      const displayRange = periodType === 'week' ? weekRangeDisplay : monthRangeDisplay;

      toast({
        title: `Analyzing ${periodType}`,
        description: `Using AI to analyze your notes for ${displayRange}...`,
      });

      // Check if we already have a cached analysis
      const cachedData = queryClient.getQueryData(['/api/analyze-period', startDate, endDate, periodType]);
      
      if (cachedData) {
        // If we have cached data, just refetch to check for updates
        if (periodType === 'week') {
          await refetchWeekly();
        } else {
          await refetchMonthly();
        }
      } else {
        // Otherwise make a direct fetch
        const response = await apiRequest('POST', '/api/analyze-period', {
          startDate,
          endDate,
          periodType
        });
        
        if (!response.ok) {
          throw new Error(`Failed to analyze ${periodType}`);
        }
        
        const data = await response.json();
        
        // Update cache
        queryClient.setQueryData(['/api/analyze-period', startDate, endDate, periodType], data);
      }

      toast({
        title: "Analysis complete",
        description: `Your notes for the ${periodType} have been analyzed!`,
      });
    } catch (error) {
      console.error(`Error analyzing ${periodType}:`, error);
      toast({
        title: "Analysis failed",
        description: `There was an error analyzing your ${periodType}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  // Function to regenerate analysis
  const regenerateAnalysis = async (periodType: PeriodType) => {
    try {
      const startDate = periodType === 'week' ? weekStart : monthStart;
      const endDate = periodType === 'week' ? weekEnd : monthEnd;
      const displayRange = periodType === 'week' ? weekRangeDisplay : monthRangeDisplay;

      toast({
        title: `Regenerating ${periodType} analysis`,
        description: `Using AI to reanalyze your notes for ${displayRange}...`,
      });

      // Make a direct fetch with regenerate parameter
      const response = await apiRequest('POST', '/api/analyze-period', {
        startDate,
        endDate,
        periodType,
        regenerate: true
      });
      
      if (!response.ok) {
        throw new Error(`Failed to regenerate ${periodType} analysis`);
      }
      
      const data = await response.json();
      
      // Update cache
      queryClient.setQueryData(['/api/analyze-period', startDate, endDate, periodType], data);

      toast({
        title: "Analysis regenerated",
        description: `Your notes for the ${periodType} have been reanalyzed!`,
      });
    } catch (error) {
      console.error(`Error regenerating ${periodType} analysis:`, error);
      toast({
        title: "Regeneration failed",
        description: `There was an error regenerating your ${periodType} analysis. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const isLoading = (activeTab === 'week' && isWeeklyFetching) || (activeTab === 'month' && isMonthlyFetching);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <Card>
        <CardHeader className="p-4 flex items-center">
          <div className="flex justify-between items-center w-full">
            <CardTitle className="text-lg my-0 ml-1">Period Analysis</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PeriodType)}>
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="week" className="pt-2">
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-xs">
                    {weekRangeDisplay}
                  </Badge>
                  {!weeklyAnalysis && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => analyzePeriod('week')}
                      disabled={isWeeklyFetching}
                    >
                      {isWeeklyFetching ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Analyze Week"
                      )}
                    </Button>
                  )}
                </div>
                
                {isWeeklyFetching ? (
                  <div className="flex items-center justify-center p-6">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : weeklyAnalysis ? (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-blue-800 font-medium">Weekly Analysis</p>
                      {weeklyAnalysis && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100 -mr-1"
                          onClick={() => regenerateAnalysis('week')}
                          title="Regenerate analysis"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none text-blue-700">
                      <ReactMarkdown>{weeklyAnalysis.analysis}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No weekly analysis available. Click "Analyze Week" to generate.
                  </p>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="month" className="pt-2">
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-xs">
                    {monthRangeDisplay}
                  </Badge>
                  {!monthlyAnalysis && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => analyzePeriod('month')}
                      disabled={isMonthlyFetching}
                    >
                      {isMonthlyFetching ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Analyze Month"
                      )}
                    </Button>
                  )}
                </div>
                
                {isMonthlyFetching ? (
                  <div className="flex items-center justify-center p-6">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : monthlyAnalysis ? (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-blue-800 font-medium">Monthly Analysis</p>
                      {monthlyAnalysis && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100 -mr-1"
                          onClick={() => regenerateAnalysis('month')}
                          title="Regenerate analysis"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none text-blue-700">
                      <ReactMarkdown>{monthlyAnalysis.analysis}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No monthly analysis available. Click "Analyze Month" to generate.
                  </p>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}