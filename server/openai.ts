import { OpenAI } from "openai";
import { Note } from "@shared/schema";

type PeriodType = "week" | "month";

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

/**
 * Analyzes a collection of notes over a period (week or month)
 * @param notes An array of notes to analyze, spanning multiple days
 * @param startDate The start date of the period in YYYY-MM-DD format
 * @param endDate The end date of the period in YYYY-MM-DD format
 * @param periodType The type of period ('week' or 'month')
 * @returns A comprehensive analysis of patterns and insights over the time period
 */
export async function analyzePeriodNotes(
  notes: Note[], 
  startDate: string, 
  endDate: string, 
  periodType: PeriodType
): Promise<string> {
  if (!notes.length) {
    return `No notes to analyze for this ${periodType}.`;
  }

  try {
    // Group notes by date for better organization
    const notesByDate = notes.reduce((acc, note) => {
      if (!acc[note.date]) {
        acc[note.date] = [];
      }
      acc[note.date].push(note);
      return acc;
    }, {} as Record<string, Note[]>);

    // Format notes for the prompt
    const formattedNotes = Object.entries(notesByDate)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, dayNotes]) => {
        const dayNotesText = dayNotes
          .map(note => `  - ${note.content}`)
          .join("\n");
        return `${date}:\n${dayNotesText}`;
      })
      .join("\n\n");

    // Adjust system prompt based on period type
    const systemPrompt = periodType === "week" 
      ? "You are an insightful journaling assistant that analyzes weekly notes and provides meaningful reflections. " +
        "Identify patterns across days, recurring themes, emotional states, and provide an analysis of the person's week. " +
        "Note any trends, changes in mood, or significant observations across the days."
      : "You are an insightful journaling assistant that analyzes monthly notes and provides meaningful reflections. " +
        "Identify patterns across the month, recurring themes, emotional states, and provide a comprehensive analysis. " +
        "Note any trends, changes in mood, or significant observations across the month, and identify any larger patterns.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using the most capable model for more thorough analysis
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Here are my notes for the ${periodType} from ${startDate} to ${endDate}:\n\n${formattedNotes}\n\nPlease analyze these entries and provide insights about my ${periodType}, including patterns, mood trends, major themes, and personal growth. Structure your response with clear sections and make it easy to read.`
        }
      ],
      temperature: 0.7,
      max_tokens: 800, // Longer output for period analysis
    });

    return response.choices[0]?.message?.content || `Unable to generate ${periodType} analysis.`;
  } catch (error) {
    console.error(`Error analyzing ${periodType} notes with OpenAI:`, error);
    return `An error occurred while analyzing your ${periodType}. Please try again later.`;
  }
}