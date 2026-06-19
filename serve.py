#!/usr/bin/env python3
# Static server para o MVP — evita os.getcwd() (bloqueado no sandbox) usando directory= explícito.
import os
import http.server
import socketserver
from functools import partial

# Diretório do próprio script (sem os.getcwd(), bloqueado no sandbox do preview).
DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8080

Handler = partial(http.server.SimpleHTTPRequestHandler, directory=DIR)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Servindo {DIR} em http://127.0.0.1:{PORT}")
    httpd.serve_forever()
