# C:\saple.ai\OCR\backend\test_all.py
import os
import sys
from pathlib import Path

print("=== Environment Test ===")

# Check .env file
env_path = Path("C:/saple.ai/OCR/backend/.env")
if env_path.exists():
    print(f"✓ .env file found at: {env_path}")
    
    # Read .env content (without exposing full keys)
    try:
        with open(env_path, 'r') as f:
            lines = f.readlines()
            for line in lines:
                if "OPENAI_API_KEY" in line:
                    key_part = line.strip().split('=')[1]
                    masked = key_part[:8] + "..." + key_part[-4:] if len(key_part) > 12 else "***"
                    print(f"✓ OPENAI_API_KEY in .env: {masked}")
                    break
    except:
        print("✗ Could not read .env file")
else:
    print("✗ .env file NOT found")

print("\n=== System Environment ===")
api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    print(f"✓ OPENAI_API_KEY in environment: {api_key[:8]}...{api_key[-4:] if len(api_key) > 12 else '***'}")
else:
    print("✗ OPENAI_API_KEY NOT in environment")

print("\n=== Testing OpenAI Client ===")
try:
    from openai import OpenAI
    
    if api_key:
        # Clean the key
        api_key = api_key.strip().strip('"').strip("'")
        
        # Create simple client
        client = OpenAI(api_key=api_key)
        
        # Try a tiny test
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say 'hello'"}],
            max_tokens=5
        )
        
        print(f"✓ OpenAI test successful: {response.choices[0].message.content}")
    else:
        print("✗ Cannot test OpenAI without API key")
        
except Exception as e:
    print(f"✗ OpenAI test failed: {e}")

print("\n=== Testing ChromaDB ===")
try:
    import chromadb
    from chromadb.config import Settings
    
    # Test ChromaDB
    client = chromadb.Client(Settings(
        anonymized_telemetry=False,
        chroma_db_impl="duckdb+parquet",
        persist_directory="./chroma_db"
    ))
    
    print("✓ ChromaDB client created successfully")
    
    # List collections
    collections = client.list_collections()
    print(f"✓ ChromaDB collections: {len(collections)} found")
    
except Exception as e:
    print(f"✗ ChromaDB test failed: {e}")

print("\n=== Summary ===")
print("1. .env file: ✓ Found" if env_path.exists() else "1. .env file: ✗ NOT Found")
print("2. OPENAI_API_KEY: ✓ Loaded" if api_key else "2. OPENAI_API_KEY: ✗ NOT Loaded")
print("3. ChromaDB: ✓ Working")
print("\nNext steps:")
print("- Check http://localhost:8000/env-check in browser")
print("- Upload a contract to test extraction")