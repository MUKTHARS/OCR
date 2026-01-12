import os
import httpx
from openai import OpenAI

def get_openai_client():
    """Get a simple OpenAI client without any proxy configuration"""
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        print("Warning: OPENAI_API_KEY environment variable is not set")
        return None
    
    try:
        # Clean the API key
        api_key = api_key.strip().strip('"').strip("'")
        
        # Create a custom HTTP client WITHOUT proxy settings
        http_client = httpx.Client(
            timeout=60.0,
            # No proxy configuration at all
        )
        
        # Create OpenAI client with custom HTTP client
        client = OpenAI(
            api_key=api_key,
            http_client=http_client
        )
        
        print(f"OpenAI client created successfully (Key: {api_key[:8]}...{api_key[-4:] if len(api_key) > 12 else '***'})")
        return client
        
    except Exception as e:
        print(f"Error creating OpenAI client: {e}")
        import traceback
        traceback.print_exc()
        
        # Last resort: try creating client without any parameters
        try:
            print("Trying minimal client creation...")
            client = OpenAI(api_key=api_key)
            print("Minimal client creation successful")
            return client
        except Exception as e2:
            print(f"Minimal approach also failed: {e2}")
            return None