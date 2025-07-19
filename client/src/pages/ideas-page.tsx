import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { type Note } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Wand2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function IdeasPage() {
  const { data: ideas, isLoading, error } = useQuery<Note[]>({
    queryKey: ['/api/ideas'],
  });

  // Format the note timestamp for display
  const formatNoteTime = (timestamp: Date | string) => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    return format(date, "MMM d, yyyy 'at' h:mm a");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Ideas</h1>
                  <p className="text-sm text-slate-600">Your best thoughts and inspirations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6">
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-4 w-3/4 mb-3" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
              <Wand2 className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Unable to load ideas</h3>
            <p className="text-slate-600">Please try again later.</p>
          </div>
        ) : ideas && ideas.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-purple-600">{ideas.length}</span> ideas collected
                </p>
              </div>
            </div>
            {ideas.map((idea) => (
              <div key={idea.id} className="idea-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-slate-700 mb-4 leading-relaxed whitespace-pre-wrap text-base">
                      {idea.content}
                    </p>
                    <div className="flex items-center space-x-3">
                      <p className="text-sm text-slate-500 font-medium">
                        {formatNoteTime(idea.timestamp)}
                      </p>
                      <span className="text-xs bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 px-3 py-1 rounded-full flex items-center font-medium border border-purple-200">
                        <Wand2 className="h-3 w-3 mr-1.5" />
                        Idea
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-200 flex items-center justify-center">
                <Wand2 className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">No ideas captured yet</h3>
              <div className="text-sm text-slate-600 space-y-3">
                <p className="pb-3 border-b border-slate-100">
                  Start marking your best thoughts and inspirations as ideas.
                </p>
                <p className="pb-3 border-b border-slate-100">
                  Use the magic wand icon on any note to add it to your ideas collection.
                </p>
                <p>Ideas help you preserve and revisit your most valuable thoughts.</p>
              </div>
              <div className="mt-6">
                <Link to="/">
                  <Button className="btn-modern">
                    Start Writing Notes
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}