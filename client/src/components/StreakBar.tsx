import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function StreakBar() {
  const { toast } = useToast();
  
  const { data: streakData, isLoading, error } = useQuery({
    queryKey: ["/api/streak"],
    queryFn: async () => {
      const response = await fetch("/api/streak");
      if (!response.ok) {
        throw new Error("Failed to fetch streak data");
      }
      return response.json();
    }
  });
  
  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch streak data",
        variant: "destructive",
      });
    }
  }, [error, toast]);
  
  if (isLoading) {
    return (
      <div className="streak-bar-container bg-white p-2 rounded-md mb-4 animate-pulse">
        <div className="h-7 bg-slate-200 rounded-md"></div>
      </div>
    );
  }
  
  const { currentStreak, longestStreak } = streakData || { currentStreak: 0, longestStreak: 0 };
  
  // Determine the appropriate color based on streak length
  const getStreakColor = (streak: number) => {
    if (streak >= 30) return "text-purple-600"; // Epic streak (30+ days)
    if (streak >= 14) return "text-blue-600";   // Great streak (14+ days)
    if (streak >= 7) return "text-green-600";   // Good streak (7+ days)
    if (streak >= 3) return "text-yellow-600";  // Starting streak (3+ days)
    return "text-gray-500";                    // No meaningful streak yet
  };
  
  return (
    <div 
      className="streak-bar-container bg-white p-2 px-3 rounded-md mb-4 shadow-sm transition-all hover:shadow-md relative before:absolute before:inset-0 before:rounded-md before:p-[1.5px] before:bg-gradient-to-r before:from-purple-400 before:via-pink-500 before:to-purple-600 before:-z-10"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Flame className={`h-5 w-5 ${getStreakColor(currentStreak)}`} />
          <div className="text-sm font-medium text-gray-800">
            {currentStreak > 0 ? (
              <>
                <span className={`font-bold ${getStreakColor(currentStreak)}`}>
                  {currentStreak}
                </span> day streak
              </>
            ) : (
              "No active streak"
            )}
          </div>
        </div>
        
        <div className="flex items-center">
          {longestStreak > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-700">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>Best: {longestStreak}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}