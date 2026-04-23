// supabase-config.js - ShopBoss Supabase Connection
const SUPABASE_URL = 'https://bulprhgwuwatzobiojwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1bHByaGd3dXdhdHpvYmlvand6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDczNDksImV4cCI6MjA5MjA4MzM0OX0.2fcHrGX7iXw5G9nGRNkBy70W1Ex_om1C0v3qbryPmvw';

// Initialize Supabase client
const shopbossSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ ShopBoss connected to Supabase! 🚀');