import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Trophy, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function StreakBar() {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  
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
      <div className="streak-bar-container bg-blue-50 p-2 rounded-md mb-4 animate-pulse">
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
  
  // Function to get appropriate encouragement message
  const getStreakMessage = () => {
    if (currentStreak === 0) return "Start your streak today!";
    if (currentStreak === 1) return "First day of your streak!";
    if (currentStreak < 3) return "Keep going!";
    if (currentStreak < 7) return "You're building momentum!";
    if (currentStreak < 14) return "Impressive dedication!";
    if (currentStreak < 30) return "You're on fire!";
    return "Legendary consistency!";
  };
  
  return (
    <div 
      className="streak-bar-container bg-white p-2 px-3 rounded-md mb-4 shadow-sm transition-all hover:shadow-md cursor-pointer relative before:absolute before:inset-0 before:rounded-md before:p-[1.5px] before:bg-gradient-to-r before:from-blue-400 before:to-blue-600 before:-z-10"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Flame className={`h-5 w-5 ${getStreakColor(currentStreak)}`} />
          <div className="text-sm font-medium text-blue-800">
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
        
        <div className="flex items-center space-x-3">
          {longestStreak > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-blue-700">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>Best: {longestStreak}</span>
            </div>
          )}
          <div className={`transform transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-blue-200 text-sm text-blue-700">
          <p className="text-center">{getStreakMessage()}</p>
          
          {currentStreak > 0 && currentStreak === longestStreak && (
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-blue-600">
              <Shield className="h-3.5 w-3.5 text-blue-500" />
              <span>You've reached your personal best!</span>
            </div>
          )}
          
          {currentStreak === 0 && (
            <div className="mt-1 text-xs text-center text-blue-600">
              Write a note today to start your streak!
            </div>
          )}
        </div>
      )}
    </div>
  );
}