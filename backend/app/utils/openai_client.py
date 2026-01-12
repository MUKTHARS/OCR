import os
from openai import OpenAI

def get_openai_client():
    """Get a simple OpenAI client without any proxy configuration"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Warning: OPENAI_API_KEY environment variable is not set")
        return None
    
    try:
        # Create the simplest possible client
        client = OpenAI(api_key=api_key)
        return client
    except Exception as e:
        print(f"Error creating OpenAI client: {e}")
        return None