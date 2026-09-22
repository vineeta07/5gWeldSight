import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print(f"Key loaded: {api_key[:5]}...{api_key[-5:]} (len {len(api_key)})")

try:
    client = genai.Client(api_key=api_key)
    print("Client created")
    
    # Try to list models
    models = list(client.models.list())
    print("Models found:")
    for m in models:
        if 'flash' in m.name:
            print(f" - {m.name}")
            
    # Try to generate content with gemini-2.5-flash
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    print(f"Testing generation with {model_name}...")
    response = client.models.generate_content(
        model=model_name, 
        contents="Hello"
    )
    print("Response:", response.text)
except Exception as e:
    import traceback
    print(f"Error type: {type(e).__name__}")
    traceback.print_exc()
