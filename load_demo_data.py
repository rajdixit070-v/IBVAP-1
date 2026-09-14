import os
import sys

# Ensure backend directory is in python path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from backend.load_demo_data import load_demo_data

if __name__ == "__main__":
    load_demo_data()
