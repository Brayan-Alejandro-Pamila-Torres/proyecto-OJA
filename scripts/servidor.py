#!/usr/bin/env python3
"""Servidor estático de desarrollo, sin caché.

`python3 -m http.server` sólo manda Last-Modified, y el navegador aplica caché
heurística: los cambios en CSS y en los módulos de JavaScript no se ven hasta
forzar la recarga. Aquí se manda no-store y siempre llega la última versión.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, formato, *args):
        if "404" in (args[1] if len(args) > 1 else ""):
            super().log_message(formato, *args)


if __name__ == "__main__":
    print(f"Viz_OJA en http://localhost:{PUERTO}  (sin caché)")
    ThreadingHTTPServer(("127.0.0.1", PUERTO), SinCache).serve_forever()
