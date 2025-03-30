import { OpenAI } from "openai";
import { Note } from "@shared/schema";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyzes a collection of notes from a specific day
 * @param notes An array of notes to analyze
 * @returns A summary of the analysis including patterns, mood, and mindset
 */
export async function analyzeNotes(notes: Note[]): Promise<string> {
  if (!notes.length) {
    return "No notes to analyze for this day.";
  }

  try {
    // Format notes for the prompt
    const formattedNotes = notes
      .map(note => `${new Date(note.timestamp).toLocaleTimeString()}: ${note.content}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: 
            "You are an insightful journaling assistant that analyzes daily notes and provides meaningful reflections. " +
            "Identify patterns, recurring themes, emotional states, and provide a brief analysis of the person's mindset for the day. " +
            "Keep your response concise (maximum 4-5 sentences) and focus on providing thoughtful insights rather than summarizing."
        },
        {
          role: "user",
          content: `Here are my notes for today:\n\n${formattedNotes}\n\nPlease analyze these entries and provide insights about my day, mood, and thought patterns.`
        }
      ],
      temperature: 0.7,
      max_tokens: 250,
    });

    return response.choices[0]?.message?.content || "Unable to generate analysis.";
  } catch (error) {
    console.error("Error analyzing notes with OpenAI:", error);
    return "An error occurred while analyzing notes. Please try again later.";
  }
}