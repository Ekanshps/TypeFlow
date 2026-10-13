"""TypeFlow — accessible, SEO-aware typing speed test web application."""
from __future__ import annotations

import os
from flask import Flask, Response, render_template, url_for
from werkzeug.middleware.proxy_fix import ProxyFix


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "local-development-key-change-before-deploy")
    app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024
    app.config["PREFERRED_URL_SCHEME"] = "https"
    # Trust forwarded host/protocol headers from ONE trusted hosting proxy.
    # Adjust x_* counts if your deployment topology uses a different proxy chain.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    @app.after_request
    def add_security_headers(response: Response) -> Response:
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' https://placehold.co https://images.unsplash.com data:; "
            "style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; "
            "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        return response

    @app.get("/")
    def index():
        return render_template("index.html", canonical=url_for("index", _external=True))

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}, 200

    @app.get("/robots.txt")
    def robots():
        sitemap_url = url_for("sitemap", _external=True)
        return Response(f"User-agent: *\nAllow: /\nDisallow: /healthz\nSitemap: {sitemap_url}\n", mimetype="text/plain")

    @app.get("/sitemap.xml")
    def sitemap():
        canonical = url_for("index", _external=True)
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            f'<url><loc>{canonical}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>'
            '</urlset>'
        )
        return Response(xml, mimetype="application/xml")

    @app.errorhandler(404)
    def not_found(_error):
        return render_template("404.html"), 404

    return app


app = create_app()

if __name__ == "__main__":
    # Development only. Use Waitress/Gunicorn for deployment (see README).
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
