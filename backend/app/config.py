from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional
import os

class Settings(BaseSettings):
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "your-supabase-anon-key")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY", None)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "your-gemini-api-key")
    
    # Model Paths (absolute or relative to backend/ app execution)
    MODEL_PATH: str = os.getenv("MODEL_PATH", "app/ml/model.joblib")
    EXPLAINER_PATH: str = os.getenv("EXPLAINER_PATH", "app/ml/explainer.joblib")
    
    # Application settings
    APP_NAME: str = "Credit Default Risk Assessor API"
    DEBUG: bool = True

    model_config = ConfigDict(env_file=".env", extra="ignore")

settings = Settings()
