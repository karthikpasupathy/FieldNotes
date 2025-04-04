import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NoteInputProps {
  date: string;
}

export default function NoteInput({ date }: NoteInputProps) {
  const [content, setContent] = useState("");
  const [charCount, setCharCount] = useState(0);
  const { toast } = useToast();
  
  const MAX_CHARS = 280;
  
  const createNoteMutation = useMutation({
    mutationFn: async (noteContent: string) => {
      const response = await apiRequest("POST", "/api/notes", {
        content: noteContent,
        date
      });
      return response.json();
    },
    onSuccess: () => {
      // Reset the form
      setContent("");
      setCharCount(0);
      
      // Refresh the notes list
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${date}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/recent-days'] });
      
      toast({
        title: "Note Added",
        description: "Your note has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to add note: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (newContent.length <= MAX_CHARS) {
      setContent(newContent);
      setCharCount(newContent.length);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (content.trim().length === 0) {
      toast({
        title: "Error",
        description: "Note content cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    
    if (content.length > MAX_CHARS) {
      toast({
        title: "Error",
        description: `Note exceeds the maximum of ${MAX_CHARS} characters.`,
        variant: "destructive",
      });
      return;
    }
    
    createNoteMutation.mutate(content);
  };
  
  // Determine character count color based on proximity to limit
  const getCharCountColor = () => {
    if (charCount > 260) return "text-red-500";
    if (charCount > 240) return "text-amber-500";
    return "text-gray-500";
  };
  
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="mb-2">
        <Textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Add a new note (280 char max)..."
          className="w-full p-3 resize-none transition focus:ring-2 focus:ring-blue-500"
          rows={3}
          maxLength={MAX_CHARS}
        />
      </div>
      <div className="flex justify-between items-center">
        <div className={`text-sm ${getCharCountColor()}`}>
          <span>{charCount}</span>/{MAX_CHARS}
        </div>
        <Button 
          type="submit" 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none transition"
          disabled={content.trim().length === 0 || createNoteMutation.isPending}
        >
          {createNoteMutation.isPending ? "Adding..." : "Add Note"}
        </Button>
      </div>
    </form>
  );
}
