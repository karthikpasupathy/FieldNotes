/**
 * Secure API Client for Daynotes
 * 
 * This module wraps the standard API client with encryption/decryption capabilities
 * while maintaining backward compatibility with unencrypted data.
 */

import { apiRequest, queryClient } from './queryClient';
import { encryptData, decryptData, isEncrypted, isEncryptionEnabled } from './encryption';
import { Note, InsertNote } from '@shared/schema';

/**
 * Securely fetch notes with automatic decryption
 * @param date The date to fetch notes for
 * @returns Promise with decrypted notes
 */
export async function fetchAndDecryptNotes(date: string): Promise<Note[]> {
  // Use the standard API fetch
  const response = await apiRequest('GET', `/api/notes/${date}`);
  const notes: Note[] = await response.json();
  
  // If encryption is not enabled, return notes as-is
  if (!isEncryptionEnabled()) {
    return notes;
  }
  
  // Process each note, decrypting content if needed
  return notes.map(note => ({
    ...note,
    content: isEncrypted(note.content) ? decryptData(note.content) : note.content
  }));
}

/**
 * Securely create a note with encryption
 * @param note The note to create (content will be encrypted)
 * @returns Promise with the created note (decrypted for client use)
 */
export async function createEncryptedNote(note: InsertNote): Promise<Note> {
  let noteToSend = { ...note };
  
  // Only encrypt if encryption is enabled
  if (isEncryptionEnabled()) {
    noteToSend = {
      ...note,
      content: encryptData(note.content)
    };
  }
  
  // Send encrypted note to server
  const response = await apiRequest('POST', '/api/notes', noteToSend);
  const createdNote: Note = await response.json();
  
  // Return decrypted version for client use
  return {
    ...createdNote,
    content: isEncrypted(createdNote.content) ? decryptData(createdNote.content) : createdNote.content
  };
}

/**
 * Securely delete a note
 * @param noteId The ID of the note to delete
 * @param userId The user ID who owns the note
 * @returns Promise with the delete result
 */
export async function deleteNote(noteId: number, userId: number): Promise<any> {
  return apiRequest('DELETE', `/api/notes/${noteId}`);
}

/**
 * Fetch and decrypt a daily analysis
 * @param date The date to fetch analysis for
 * @param userId The user ID
 * @returns Promise with the decrypted analysis
 */
export async function fetchAndDecryptAnalysis(date: string, userId: number): Promise<string | null> {
  const response = await apiRequest('GET', `/api/analysis/${date}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch analysis');
  }
  
  const result = await response.json();
  const analysis = result.analysis || null;
  
  // If encryption is not enabled or analysis is null, return as-is
  if (!isEncryptionEnabled() || !analysis) {
    return analysis;
  }
  
  // Decrypt if the analysis is encrypted
  return isEncrypted(analysis) ? decryptData(analysis) : analysis;
}

/**
 * Save an encrypted analysis
 * @param date The date for the analysis
 * @param analysis The analysis content to encrypt and save
 * @param userId The user ID
 * @returns Promise with the API response
 */
export async function saveEncryptedAnalysis(date: string, analysis: string, userId: number): Promise<any> {
  let analysisToSend = analysis;
  
  // Only encrypt if encryption is enabled
  if (isEncryptionEnabled()) {
    analysisToSend = encryptData(analysis);
  }
  
  return apiRequest('POST', `/api/analysis/${date}`, { analysis: analysisToSend });
}

/**
 * Fetch and decrypt period analysis (week/month)
 * @param params The period analysis parameters
 * @returns Promise with decrypted period analysis
 */
export async function fetchAndDecryptPeriodAnalysis(params: {
  startDate: string;
  endDate: string;
  periodType: string;
}): Promise<any> {
  const response = await apiRequest('GET', 
    `/api/period-analysis?startDate=${params.startDate}&endDate=${params.endDate}&periodType=${params.periodType}`
  );
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch period analysis');
  }
  
  const result = await response.json();
  
  // If encryption is not enabled, return as-is
  if (!isEncryptionEnabled()) {
    return result;
  }
  
  // Decrypt analysis content if needed
  if (result && result.analysis && isEncrypted(result.analysis)) {
    return {
      ...result,
      analysis: decryptData(result.analysis)
    };
  }
  
  return result;
}

/**
 * Save encrypted period analysis
 * @param periodAnalysis The period analysis to encrypt and save
 * @returns Promise with API response
 */
export async function saveEncryptedPeriodAnalysis(periodAnalysis: any): Promise<any> {
  let analysisToSend = { ...periodAnalysis };
  
  // Only encrypt if encryption is enabled
  if (isEncryptionEnabled() && periodAnalysis.analysis) {
    analysisToSend = {
      ...periodAnalysis,
      analysis: encryptData(periodAnalysis.analysis)
    };
  }
  
  return apiRequest('POST', '/api/period-analysis', analysisToSend);
}

/**
 * Fetch and decrypt moments
 * @returns Promise with decrypted moments
 */
export async function fetchAndDecryptMoments(): Promise<Note[]> {
  const response = await apiRequest('GET', '/api/moments');
  const moments: Note[] = await response.json();
  
  // If encryption is not enabled, return as-is
  if (!isEncryptionEnabled()) {
    return moments;
  }
  
  // Decrypt each moment's content if needed
  return moments.map(note => ({
    ...note,
    content: isEncrypted(note.content) ? decryptData(note.content) : note.content
  }));
}

/**
 * Fetch and decrypt moments analysis
 * @returns Promise with decrypted moments analysis
 */
export async function fetchAndDecryptMomentsAnalysis(): Promise<string | null> {
  const response = await apiRequest('GET', '/api/moments/analysis');
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch moments analysis');
  }
  
  const result = await response.json();
  const analysis = result.analysis || null;
  
  // If encryption is not enabled or analysis is null, return as-is
  if (!isEncryptionEnabled() || !analysis) {
    return analysis;
  }
  
  // Decrypt if the analysis is encrypted
  return isEncrypted(analysis) ? decryptData(analysis) : analysis;
}

/**
 * Toggle moment status with encryption support
 * @param noteId The note ID to toggle
 * @returns Promise with toggle result
 */
export async function toggleMoment(noteId: number): Promise<any> {
  // No encryption needed for toggle action
  return apiRequest('POST', `/api/notes/${noteId}/toggle-moment`);
}

/**
 * Generate encrypted moments analysis
 * @returns Promise with encrypted moments analysis result
 */
export async function generateEncryptedMomentsAnalysis(): Promise<any> {
  const response = await apiRequest('POST', '/api/moments/analyze');
  
  if (!response.ok) {
    throw new Error('Failed to generate moments analysis');
  }
  
  const result = await response.json();
  
  // Invalidate moments analysis query to trigger refetch
  queryClient.invalidateQueries({ queryKey: ['/api/moments/analysis'] });
  
  return result;
}

/**
 * Utility to invalidate appropriate queries after data changes
 * @param date Optional specific date to invalidate
 */
export function invalidateEncryptedQueries(date?: string): void {
  // Invalidate specific date if provided
  if (date) {
    queryClient.invalidateQueries({ queryKey: [`/api/notes/${date}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/analysis/${date}`] });
  }
  
  // Always invalidate these common queries
  queryClient.invalidateQueries({ queryKey: ['/api/recent-days'] });
  queryClient.invalidateQueries({ queryKey: ['/api/dates-with-notes'] });
  
  // For moments-related changes
  queryClient.invalidateQueries({ queryKey: ['/api/moments'] });
}