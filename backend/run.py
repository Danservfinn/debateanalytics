"""
Entry point for running the FastAPI application.
"""
import sys
import os

print("=== STARTUP ===")
print(f"CWD: {os.getcwd()}")
print(f"Python: {sys.version}")

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
print(f"Added to path: {backend_dir}")

# Test imports step by step
print("\nImporting modules...")

try:
    print("  1. config...")
    from config import Config
    print("     OK")
except Exception as e:
    print(f"     FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("  2. cache.cache_manager...")
    from cache.cache_manager import CacheManager
    print("     OK")
except Exception as e:
    print(f"     FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("  3. data.reddit_fetcher...")
    from data.reddit_fetcher import RedditFetcher
    print("     OK")
except Exception as e:
    print(f"     FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("  4. analysis.claude_client...")
    from analysis.claude_client import ClaudeClient
    print("     OK")
except Exception as e:
    print(f"     FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("  5. api.main...")
    from api.main import app
    print("     OK")
except Exception as e:
    print(f"     FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\nAll imports successful!")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
