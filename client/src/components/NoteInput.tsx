import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { createEncryptedNote, invalidateEncryptedQueries } from "@/lib/secureApi";
import { Lock } from "lucide-react";

interface NoteInputProps {
  date: string;
}

export default function NoteInput({ date }: NoteInputProps) {
  const [content, setContent] = useState("");
  const [charCount, setCharCount] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const MAX_CHARS = 280;
  
  const createNoteMutation = useMutation({
    mutationFn: async (noteContent: string) => {
      // Use the secure API to create an encrypted note if encryption is enabled
      return createEncryptedNote({
        content: noteContent,
        date,
        userId: user?.id || 0,
        isMoment: false
      });
    },
    onSuccess: () => {
      // Reset the form
      setContent("");
      setCharCount(0);
      
      // Refresh the notes list using the invalidate helper
      invalidateEncryptedQueries(date);
      
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
    return "text-blue-600";
  };
  
  return (
    <form onSubmit={handleSubmit} className="rounded-lg shadow-md p-4 mb-6 border border-gray-100 bg-white">
      <div className="mb-2">
        <Textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Add a new note (280 char max)..."
          className="w-full p-3 resize-none transition focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-md border-blue-200"
          rows={3}
          maxLength={MAX_CHARS}
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.05)"
          }}
        />
      </div>
      <div className="flex justify-between items-center">
        <div className={`text-sm font-medium ${getCharCountColor()}`}>
          <span>{charCount}</span>/{MAX_CHARS}
        </div>
        <Button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-5 py-2 transition-all duration-300"
          disabled={content.trim().length === 0 || createNoteMutation.isPending}
        >
          {createNoteMutation.isPending ? "Adding..." : "Add Note"}
        </Button>
      </div>
    </form>
  );
}
