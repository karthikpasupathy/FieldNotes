import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDateForAPI } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, RefreshCw, ChevronDown, ChevronUp, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  fetchAndDecryptPeriodAnalysis, 
  saveEncryptedPeriodAnalysis 
} from "@/lib/secureApi";
import { useAuth } from "@/hooks/use-auth";
import { isEncryptionEnabled } from "@/lib/encryption";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PeriodType = "week" | "month";

interface PeriodAnalysisProps {
  currentDate: Date;
}

export default function PeriodAnalysis({ currentDate }: PeriodAnalysisProps) {
  const [activeTab, setActiveTab] = useState<PeriodType>("week");
  const [isOpen, setIsOpen] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Get the date ranges for week and month
  const weekStart = formatDateForAPI(startOfWeek(currentDate, { weekStartsOn: 1 }));
  const weekEnd = formatDateForAPI(endOfWeek(currentDate, { weekStartsOn: 1 }));
  const monthStart = formatDateForAPI(startOfMonth(currentDate));
  const monthEnd = formatDateForAPI(endOfMonth(currentDate));

  // Format date ranges for display
  const weekRangeDisplay = `${format(parseISO(weekStart), 'MMM d')} - ${format(parseISO(weekEnd), 'MMM d, yyyy')}`;
  const monthRangeDisplay = format(parseISO(monthStart), 'MMMM yyyy');

  // Query for weekly analysis with encryption support
  const {
    data: weeklyAnalysis,
    isLoading: isWeeklyLoading,
    isFetching: isWeeklyFetching,
    refetch: refetchWeekly
  } = useQuery<{ analysis: string } | null>({
    queryKey: ['/api/analyze-period', weekStart, weekEnd, 'week'],
    queryFn: async () => fetchAndDecryptPeriodAnalysis({
      startDate: weekStart,
      endDate: weekEnd,
      periodType: 'week'
    }),
    enabled: false,
    staleTime: Infinity // Period analysis doesn't change unless explicitly regenerated
  });

  // Query for monthly analysis with encryption support
  const {
    data: monthlyAnalysis,
    isLoading: isMonthlyLoading,
    isFetching: isMonthlyFetching,
    refetch: refetchMonthly
  } = useQuery<{ analysis: string } | null>({
    queryKey: ['/api/analyze-period', monthStart, monthEnd, 'month'],
    queryFn: async () => fetchAndDecryptPeriodAnalysis({
      startDate: monthStart,
      endDate: monthEnd,
      periodType: 'month'
    }),
    enabled: false,
    staleTime: Infinity // Period analysis doesn't change unless explicitly regenerated
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
        const periodAnalysisData = {
          startDate,
          endDate,
          periodType,
          userId: user?.id
        };

        // Create a new period analysis with encryption support if enabled
        const result = await saveEncryptedPeriodAnalysis(periodAnalysisData);
        
        if (!result) {
          throw new Error(`Failed to analyze ${periodType}`);
        }
        
        // Fetch the newly created analysis with decryption support
        const analysis = await fetchAndDecryptPeriodAnalysis({
          startDate,
          endDate,
          periodType
        });
        
        // Update the cache with the decrypted analysis
        queryClient.setQueryData(['/api/analyze-period', startDate, endDate, periodType], analysis);
        
        // Manually trigger the query refetch to make sure UI updates
        if (periodType === 'week') {
          await refetchWeekly();
        } else {
          await refetchMonthly();
        }
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

      // Prepare regeneration parameters
      const regenerationData = {
        startDate,
        endDate,
        periodType,
        userId: user?.id,
        regenerate: true
      };

      // Regenerate the analysis with encryption support
      const result = await saveEncryptedPeriodAnalysis(regenerationData);
      
      if (!result) {
        throw new Error(`Failed to regenerate ${periodType} analysis`);
      }
      
      // Fetch the newly regenerated analysis with decryption support
      const analysis = await fetchAndDecryptPeriodAnalysis({
        startDate,
        endDate,
        periodType
      });
      
      // Update the cache with the decrypted regenerated analysis
      queryClient.setQueryData(['/api/analyze-period', startDate, endDate, periodType], analysis);
      
      // Manually trigger the query refetch to make sure UI updates
      if (periodType === 'week') {
        await refetchWeekly();
      } else {
        await refetchMonthly();
      }

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

  // Effect to initialize queries when component mounts
  useEffect(() => {
    if (!hasInitialized && user) {
      // Check if we have existing analyses in the cache
      const weekCachedData = queryClient.getQueryData(['/api/analyze-period', weekStart, weekEnd, 'week']);
      const monthCachedData = queryClient.getQueryData(['/api/analyze-period', monthStart, monthEnd, 'month']);
      
      // If no cached data, attempt to fetch both analyses
      if (!weekCachedData) {
        refetchWeekly();
      }
      
      if (!monthCachedData) {
        refetchMonthly();
      }
      
      setHasInitialized(true);
    }
  }, [user, hasInitialized, weekStart, weekEnd, monthStart, monthEnd, refetchWeekly, refetchMonthly]);

  const isLoading = (activeTab === 'week' && isWeeklyFetching) || (activeTab === 'month' && isMonthlyFetching);

  // Check if encryption is enabled for the user
  const encryptionEnabled = user && isEncryptionEnabled();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <Card className="card-gradient border border-blue-100 shadow-md">
        <CardHeader className="p-4 flex items-center">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg my-0 ml-1 text-blue-900">Period Analysis</CardTitle>
              {encryptionEnabled && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Lock className="h-3.5 w-3.5 text-blue-600" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Encrypted data</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-blue-50 transition-colors">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-blue-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PeriodType)}>
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-2 bg-blue-50 p-1 rounded-lg border border-blue-200">
                <TabsTrigger 
                  value="week" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white data-[state=inactive]:text-black rounded-md transition-all duration-300 font-medium"
                >
                  This Week
                </TabsTrigger>
                <TabsTrigger 
                  value="month" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white data-[state=inactive]:text-black rounded-md transition-all duration-300 font-medium"
                >
                  This Month
                </TabsTrigger>
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
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-md"
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
                  <div className="analysis-box">
                    <div className="analysis-box-header">
                      <div className="analysis-box-title">Weekly Analysis</div>
                      {weeklyAnalysis && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 -mr-1 rounded-full"
                                onClick={() => regenerateAnalysis('week')}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Regenerate analysis</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="analysis-content">
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
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-md" 
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
                  <div className="analysis-box">
                    <div className="analysis-box-header">
                      <div className="analysis-box-title">Monthly Analysis</div>
                      {monthlyAnalysis && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 -mr-1 rounded-full"
                                onClick={() => regenerateAnalysis('month')}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Regenerate analysis</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="analysis-content">
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