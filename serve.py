"""Static server for the Elizabeth Loya site that never caches.

Run it through START.bat rather than directly.

Why a server instead of double-clicking dist\\index.html:

  1. The site builds directory-style URLs — /about is really
     /about/index.html. Under file:// those links resolve to a folder
     and the browser shows a directory listing or nothing at all.
  2. Every asset is referenced from the site root (/media/..., /_astro/...).
     file:// resolves those against the drive root, so the CSS, fonts,
     images and video all 404 and you get unstyled text.

Python's stock http.server sends Last-Modified and no Cache-Control, so
Chrome holds on to hashed assets across rebuilds and you end up checking
the previous build. Everything here is served no-store.
"""
import functools
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class SingleInstanceServer(ThreadingHTTPServer):
    """Refuse to start if the port is already serving.

    HTTPServer sets allow_reuse_address = True, which on Windows lets a
    SECOND server bind a port already in use. Both then sit on the port
    and which one answers is anyone's guess — so START.bat can look like
    it is running fine while the browser is being served a different
    folder entirely, and you review the wrong build.
    """
    allow_reuse_address = False


if __name__ == "__main__":
    port = int(sys.argv[1])
    root = sys.argv[2]
    handler = functools.partial(NoCacheHandler, directory=root)
    try:
        server = SingleInstanceServer(("127.0.0.1", port), handler)
    except OSError:
        print()
        print("  Port %d is already in use." % port)
        print()
        print("  The site is probably already running — check for another")
        print("  START window, or a browser tab already open at")
        print("  http://localhost:%d" % port)
        print()
        print("  Close the other one and try again.")
        print()
        sys.exit(1)
    print("serving %s on http://localhost:%d (no-store)" % (root, port))
    sys.stdout.flush()
    server.serve_forever()
