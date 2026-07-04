const SUPABASE_URL = "https://kltiizfwuwzzzfsvbzpn.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdGlpemZ3dXd6enpmc3ZienBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTA4NzUsImV4cCI6MjA5Nzk2Njg3NX0.pYSGf9yYB1n7ldYPyRMQC4mX_WnZko3-qTQ2HQbP_F4";

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
