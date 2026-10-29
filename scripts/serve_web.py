#!/usr/bin/env python3
"""
scripts/serve_web.py — Lightweight static server for Expo Web export with clean HTML routing.
Serves on http://localhost:8081.
"""

from __future__ import annotations

import http.server
import os
import socketserver
from pathlib import Path

PORT = 8081
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def end_headers(self):
        # Never cache HTML shells; bundles are content-hashed, but the shell
        # must always point at the latest export.
        if self.path.endswith('.html') or '.' not in self.path.split('/')[-1]:
            self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_GET(self):
        # Extract path without query parameters
        clean_path = self.path.split("?")[0].lstrip("/")
        target_file = DIST_DIR / clean_path

        # 1. Exact file or directory
        if target_file.exists() and not target_file.is_dir():
            return super().do_GET()

        # 2. Path.html (e.g. /home -> home.html, /snap -> snap.html)
        html_file = DIST_DIR / f"{clean_path}.html"
        if html_file.exists():
            self.path = f"/{clean_path}.html"
            return super().do_GET()

        # 3. Dynamic routes like /expense/[id]
        if clean_path.startswith("expense/"):
            dyn_file = DIST_DIR / "expense" / "[id].html"
            if dyn_file.exists():
                self.path = "/expense/[id].html"
                return super().do_GET()

        # 4. Fallback to index.html
        if not (DIST_DIR / clean_path).exists():
            self.path = "/index.html"

        return super().do_GET()

def run_server():
    os.chdir(str(DIST_DIR))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), SPARequestHandler) as httpd:
        print(f"🚀 Expense Capture Web serving on http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")


if __name__ == "__main__":
    run_server()
