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
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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

/**
 * Analyzes a collection of moments (specially marked notes)
 * @param moments An array of notes that have been marked as moments
 * @returns An analysis of patterns and insights across these special moments
 */
export async function analyzeMoments(moments: Note[]): Promise<string> {
  if (!moments.length) {
    return "No moments to analyze yet. Mark some notes as moments to get insights.";
  }

  try {
    // Group moments by date for better organization
    const momentsByDate = moments.reduce((acc, moment) => {
      if (!acc[moment.date]) {
        acc[moment.date] = [];
      }
      acc[moment.date].push(moment);
      return acc;
    }, {} as Record<string, Note[]>);

    // Format moments for the prompt
    const formattedMoments = Object.entries(momentsByDate)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, dayMoments]) => {
        const dayMomentsText = dayMoments
          .map(moment => `  - ${moment.content}`)
          .join("\n");
        return `${date}:\n${dayMomentsText}`;
      })
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: 
            "You are an insightful journaling assistant that analyzes specially marked 'moments' - entries that were particularly meaningful to the user. " +
            "Moments can span across different days and contexts. Your job is to identify patterns, recurring themes, and provide an analysis of what matters most to this person. " +
            "Look for connections between moments, common emotional threads, values, and priorities revealed by these special entries. " +
            "Be thoughtful, empathetic, and provide a deeper understanding of what the user finds most significant in their life."
        },
        {
          role: "user",
          content: `Here are my specially marked moments:\n\n${formattedMoments}\n\nPlease analyze these moments and provide insights about what matters most to me, the patterns across these special entries, and what they reveal about my values and priorities. Structure your response into clear sections and make it easy to read.`
        }
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    return response.choices[0]?.message?.content || "Unable to generate analysis of your moments.";
  } catch (error) {
    console.error("Error analyzing moments with OpenAI:", error);
    return "An error occurred while analyzing your moments. Please try again later.";
  }
}