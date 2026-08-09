#!/usr/bin/env python3
"""A minimal static server for LUMEN.

    python3 serve.py              → http://localhost:4173, this Mac only
    python3 serve.py 8080         → a different port
    python3 serve.py --lan        → also reachable from your phone on the
                                    same Wi-Fi, at http://<this-mac>:4173

Loopback is the default on purpose: with --lan, anything on your network can
load the app. That does not expose your journal — entries live in the browser
on each device, never on this server — but it does serve this folder to the
network, so use it on networks you trust.

Responses carry Cache-Control: no-store, which keeps the browser honest while
you are editing and costs nothing for a local, single-user app.
"""

import functools
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quiet by default: a journal should not narrate itself to a terminal.
        pass


def lan_address():
    """This machine's address on the local network, or None if offline."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No packets are sent; this just asks the OS which interface it
        # would route through, which is the address a phone can reach.
        probe.connect(("192.0.2.1", 9))
        return probe.getsockname()[0]
    except OSError:
        return None
    finally:
        probe.close()


def main():
    args = [a for a in sys.argv[1:]]
    lan = "--lan" in args
    ports = [a for a in args if a.isdigit()]
    port = int(ports[0]) if ports else 4173

    host = "0.0.0.0" if lan else "127.0.0.1"
    handler = functools.partial(Handler, directory=ROOT)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((host, port), handler) as httpd:
        local = f"http://localhost:{port}/"
        print(f"LUMEN → {local}")

        if lan:
            address = lan_address()
            if address:
                print(f"On your phone → http://{address}:{port}/")
                print("(same Wi-Fi network; the phone keeps its own journal)")
            else:
                print("No network address found — this Mac may be offline.")

        print("Press Ctrl-C to stop.")
        threading.Timer(0.8, lambda: webbrowser.open(local)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nGoodnight.")


if __name__ == "__main__":
    main()
