from supabase import create_client, Client
from app.config import settings

def get_supabase_client() -> Client:
    """
    Initializes and returns a Supabase client.
    Uses the Service Role Key if available (for backend operations bypassing RLS),
    otherwise falls back to the client-side Anon Key.
    """
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
    return create_client(settings.SUPABASE_URL, key)
