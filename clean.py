import os
import sys

# Ensure backend directory is in sys.path
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(root_dir, "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

def run_clean():
    import urllib.request
    import urllib.error

    # 1. Try connecting to the live backend server first
    try:
        req = urllib.request.Request("http://localhost:8000/api/v1/demo/clean", method="POST")
        with urllib.request.urlopen(req, timeout=45) as response:
            if response.status in (200, 201):
                print("================================================================================")
                print(" [SUCCESS] IBVAP DATABASE CLEARED TO PRISTINE CLEAN STATE")
                print("================================================================================")
                print(" [+] Surveillance Cameras:  0 (All fake/synthetic cameras cleared - ready for real feeds)")
                print(" [+] Fake Events Cleared:   0 events, 0 alerts, 0 incidents, 0 evidence, 0 observations")
                print(" [+] Admin Clearance:       admin / Admin@IBVAP2026")
                print(" [+] Default Officer:       officer_alpha / Officer@IBVAP2026")
                print("================================================================================")
                return
    except urllib.error.URLError:
        # Backend not running, proceed to direct DB execution
        pass
    except Exception as e:
        print(f"[-] Backend API notice: {e}")

    # 2. Fallback to direct Python database purge when server is offline
    try:
        from backend.clear_data import clear_database
        clear_database()
    except ImportError:
        import clear_data
        clear_data.clear_database()

if __name__ == "__main__":
    run_clean()
