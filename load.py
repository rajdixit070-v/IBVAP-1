import os
import sys

# Ensure backend directory is in sys.path
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(root_dir, "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

def run_load():
    import urllib.request
    import urllib.error

    # 1. Try connecting to the live backend server first
    try:
        req = urllib.request.Request("http://localhost:8000/api/v1/demo/load", method="POST")
        with urllib.request.urlopen(req, timeout=45) as response:
            if response.status in (200, 201):
                print("================================================================================")
                print(" [SUCCESS] IBVAP DEMONSTRATION FLEET LOADED")
                print("================================================================================")
                print(" [+] Tactical Cameras:      17 cameras deployed across 6 Frontier Sectors")
                print(" [+] Tactical Edge Nodes:   4 Jetson Orin appliances online")
                print(" [+] Incidents & Evidence:  Forensic vault HUD frames populated")
                print(" [+] Active Watchlists:     ANPR license plates & facial entries active")
                print("================================================================================")
                return
    except urllib.error.URLError:
        # Backend not running, proceed to direct DB execution
        pass
    except Exception as e:
        print(f"[-] Backend API notice: {e}")

    # 2. Fallback to direct Python database seeding when server is offline
    try:
        from load_demo_data import load_demo_data
        load_demo_data()
    except (ImportError, ModuleNotFoundError):
        from backend.load_demo_data import load_demo_data
        load_demo_data()

if __name__ == "__main__":
    run_load()
