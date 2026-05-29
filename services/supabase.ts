// Supabase REST Configurations (Zero external package dependencies!)
// Replace these placeholders with your actual Supabase URL and Anon Key from your Supabase Dashboard:
// Settings -> API -> Project URL & Project API Keys
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vxjyxsbjypniuurvwpmn.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4anl4c2JqeXBuaXV1cnZ3cG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NjU0NTAsImV4cCI6MjA5NDU0MTQ1MH0.G5COJbTyRvCMjxVtlg5DN2VvJ3wcQLHuj8jO-t8nzcI';

/**
 * Uploads a binary file blob directly to your Supabase 'media' bucket using the native HTTP REST API.
 * This is 100% compile-safe, lightweight, and requires no external libraries.
 * 
 * @param filePath The destination path in the bucket (e.g. "chats/room_101/media/filename.jpg")
 * @param blob The binary file blob
 * @param mimeType The file MIME type (e.g. "image/jpeg" or "video/mp4")
 * @returns The permanent, public URL of the uploaded media asset
 */
export const uploadToSupabaseRest = async (filePath: string, blob: Blob, mimeType: string): Promise<string> => {
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/media/${filePath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'apiKey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': mimeType,
    },
    body: blob,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Supabase REST Upload failed: ${errText}`);
  }

  // Construct and return permanent public URL directly
  return `${SUPABASE_URL}/storage/v1/object/public/media/${filePath}`;
};
