# Deployment

One small server (AWS EC2, Ubuntu 24.04, 1 GB RAM) runs everything:

```
Internet ──HTTPS──► Caddy ─┬─ /api/, /admin/, /static/ → Django (gunicorn) ─► PostgreSQL + pgvector
                           └─ everything else           → Angular build (index.html fallback)
```

The app and the API share one origin: the refresh cookie needs no cross-site
setting and no CORS is involved. Caddy gets and renews the HTTPS certificate.

| File | Role |
|---|---|
| `docker-compose.prod.yml` | db, api, caddy services |
| `Caddyfile` | HTTPS, routing, security and cache headers |
| `.env.example` | server configuration template, copied to `.env` on the server |
| `server-setup.sh` | one-time server setup: Docker, swap, code, backup cron |
| `deploy.sh` | deploys `origin/main` from a developer PC |
| `backup.sh` | daily database dump, 14 days kept |

## First deployment

Prerequisites: the EC2 instance with an Elastic IP, ports 22 (your IP only),
80 and 443 open, and the SSH key in `~/.ssh/saas-gestionemp-key.pem`.

1. **Set up the server** (once). From your PC:

   ```
   ssh -i ~/.ssh/saas-gestionemp-key.pem ubuntu@<IP>
   curl -fsSL https://raw.githubusercontent.com/13nerubepe/Saas-gestionEmp/main/deploy/server-setup.sh | bash
   exit
   ```

   Reconnect afterwards so the `docker` group applies.

2. **Configure** (once), on the server:

   ```
   cd ~/saas-gestionemp/deploy
   cp .env.example .env
   python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # SECRET_KEY
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # POSTGRES_PASSWORD
   nano .env
   ```

   Set `APP_DOMAIN` (without a domain name: IP `13.37.42.1` → `13-37-42-1.sslip.io`),
   `SECRET_KEY`, `POSTGRES_PASSWORD` and `GEMINI_API_KEY`. Then `chmod 600 .env`.

3. **Deploy**, from the repository root on your PC (Git Bash):

   ```
   deploy/deploy.sh <IP>
   ```

4. **Create an admin account and load the legal texts**, on the server:

   ```
   cd ~/saas-gestionemp/deploy
   docker compose -f docker-compose.prod.yml exec api python manage.py createsuperuser
   docker compose -f docker-compose.prod.yml cp texts.json api:/tmp/texts.json
   docker compose -f docker-compose.prod.yml exec api python manage.py load_legal_texts /tmp/texts.json
   ```

## Every deployment

Merge to `main` (CI green), then `deploy/deploy.sh <IP>`. The script builds the
Angular app locally, resets the server to `origin/main`, uploads the build,
rebuilds the containers (migrations run at api start) and checks
`/api/v1/health/`.

## Operations

All commands on the server, in `~/saas-gestionemp/deploy`:

| Task | Command |
|---|---|
| Status | `docker compose -f docker-compose.prod.yml ps` |
| Logs | `docker compose -f docker-compose.prod.yml logs -f --tail 100 api` |
| Django shell | `docker compose -f docker-compose.prod.yml exec api python manage.py shell` |
| Manual backup | `./backup.sh` (dumps in `~/backups`) |
| Restore a dump | `gunzip -c ~/backups/db-XXXX.sql.gz \| docker compose -f docker-compose.prod.yml exec -T db psql -U app -d app` (into an empty database) |
| Memory | `free -h` and `docker stats --no-stream` |

Backups stay on the same disk: copy them elsewhere (S3, your PC) for real
safety, e.g. `scp -i ~/.ssh/saas-gestionemp-key.pem ubuntu@<IP>:backups/*.gz .`

## Notes

- `python manage.py check --deploy` reports SECURE_SSL_REDIRECT and HSTS:
  Caddy handles both. The email warning stays until emails are sent.
- The Gemini free tier has small quotas per model. `GEMINI_FALLBACK_MODEL`
  answers when the main model is overloaded or out of quota; if both are, the
  API returns 503 `llm_unavailable`. Real users need a paid key.
- Variables in `.env` lose against variables of the same name in the shell
  that runs Docker Compose; hence the unusual name `APP_DOMAIN`.
