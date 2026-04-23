// supabase-config.js - ShopBoss Supabase Connection
const SUPABASE_URL = 'https://bulprhgwuwatzobiojwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1bHByaGd3dXdhdHpvYmlvand6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDczNDksImV4cCI6MjA5MjA4MzM0OX0.2fcHrGX7iXw5G9nGRNkBy70W1Ex_om1C0v3qbryPmvw';

// Create Supabase client - wait for the SDK to load
let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  // Check if supabase SDK is loaded
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client created!');
    return supabaseClient;
  }
  
  console.error('❌ Supabase SDK not loaded yet!');
  return null;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const client = getSupabase();
  if (client) {
    console.log('✅ ShopBoss connected to Supabase! 🚀');
  } else {
    console.warn('⚠️ Supabase not available, using localStorage only');
  }
});