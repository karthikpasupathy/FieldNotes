import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

type SearchResult = {
  id: number;
  content: string;
  timestamp: string;
  date: string;
  userId: number;
  analysis: string | null;
  isMoment: boolean;
};

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Debounce search to avoid too many API calls
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    
    // Clear the previous timeout
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(e.target.value);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
  };

  // Search query
  const { data: searchResults, isLoading } = useQuery<SearchResult[]>({
    queryKey: ['/api/search', debouncedSearchTerm],
    queryFn: async ({ queryKey }) => {
      if (!debouncedSearchTerm) return [];
      const endpoint = `/api/search?query=${encodeURIComponent(debouncedSearchTerm)}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to search notes');
      }
      return response.json();
    },
    enabled: debouncedSearchTerm.length > 0,
  });

  // Navigate to the specific date page when clicking on a search result
  const handleResultClick = (date: string) => {
    setLocation(`/day/${date}`);
  };

  // Format the date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'EEEE, MMMM d, yyyy');
    } catch (error) {
      return dateStr;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Search Your Notes</h1>
      
      <div className="relative mb-8">
        <div className="flex w-full max-w-lg">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search your notes..."
              className="pl-8 pr-10"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button 
            variant="default" 
            className="ml-2"
            disabled={!searchTerm || isLoading}
            onClick={() => setDebouncedSearchTerm(searchTerm)}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
      </div>

      {/* Search Results */}
      {debouncedSearchTerm && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">
            {isLoading ? (
              <span className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching...
              </span>
            ) : (
              searchResults && (
                <span>Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
              )
            )}
          </h2>

          {!isLoading && searchResults && searchResults.length === 0 && (
            <p className="text-muted-foreground py-4">No notes found for "{debouncedSearchTerm}"</p>
          )}

          {!isLoading && searchResults && searchResults.length > 0 && (
            <div className="space-y-4">
              {searchResults.map((result) => (
                <Card key={result.id} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => handleResultClick(result.date)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <span>{formatDate(result.date)}</span>
                      {result.isMoment && (
                        <span className="ml-2 text-yellow-500">✨</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(result.timestamp), 'h:mm a')}
                    </p>
                    <Separator className="my-2" />
                    <p>{result.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}