from http.server import HTTPServer, SimpleHTTPRequestHandler


def main() -> None:
    server = HTTPServer(('127.0.0.1', 8000), SimpleHTTPRequestHandler)
    server.serve_forever()


if __name__ == '__main__':
    main()
