# GestionEmp

Virtual back office for founders, Cameroon first: clients, invoices in XAF,
payments (Mobile Money), cash, a financial advisor and a legal assistant
grounded in the texts that apply. Product and architecture:
[.claude/CLAUDE.md](.claude/CLAUDE.md). Day-to-day rules: [CONTRIBUTING.md](CONTRIBUTING.md).

## Run it on your computer

Requirements: **Git**, **Docker Desktop**, **Python 3.13**, **Node.js 22** with
**npm 11** (`npm install -g npm@11`: the lockfile is written by npm 11, and
the npm 10 bundled with Node 22 rejects it).

### 1. Get the code

```
git clone https://github.com/13nerubepe/Saas-gestionEmp.git
cd Saas-gestionEmp
```

Already cloned: `git checkout main && git pull`.

### 2. Backend (Django API on http://localhost:8000)

```
docker compose up -d db                  # PostgreSQL + pgvector on port 5434

cd rest-erpemployes
python -m venv venv
venv\Scripts\activate                    # Windows; macOS/Linux: source venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env                   # Windows; macOS/Linux: cp .env.example .env
```

In `.env`, set `SECRET_KEY` to any long random string, for example the output of
`python -c "import secrets; print(secrets.token_urlsafe(50))"`. Then:

```
python manage.py migrate
python manage.py seed_demo               # fictitious company to try every screen
python manage.py runserver
```

Leave it running. API docs: http://localhost:8000/api/docs/

### 3. Frontend (Angular on http://localhost:4200), in a second terminal

```
cd web-erpemployes
npm ci
npm start
```

Open http://localhost:4200 and sign in with a demo account:

| Account | Email | Password |
|---|---|---|
| Founder (sees everything) | `demo@gestionemp.cm` | `Demo-Douala-2026` |
| Employee | `employe@gestionemp.cm` | `Demo-Douala-2026` |

The demo company has clients and prospects, an overdue invoice partly paid by
MTN Mobile Money, a credit note, a draft, cash movements and a cash balance
under its alert threshold. Every amount is fictitious.

### AI answers

By default `.env` uses `LLM_PROVIDER=fake`: the advisor, payment reminders and
legal assistant answer with canned text, so every screen works without a key.
For real answers, put `LLM_PROVIDER=gemini` and a free key from
https://aistudio.google.com/ in `GEMINI_API_KEY`, use fictitious data only,
then load the Labour Code for the legal assistant (about 2 minutes, free-tier
quota):

```
python manage.py load_legal_texts data/legal_texts/cm-code-travail-1992.json
```

### Without Python on the machine

`docker compose up` runs PostgreSQL and the API together (migrations included).
Then `docker compose exec api python manage.py seed_demo`, and start the
frontend as in step 3.

## Tests

```
cd rest-erpemployes && pytest            # backend: needs the database from step 2
cd web-erpemployes && npm run test:ci    # frontend: needs Chrome
```

## Common problems

| Symptom | Fix |
|---|---|
| `npm ci` says package.json and package-lock.json are out of sync | `npm install -g npm@11`, then `npm ci` again |
| `connection refused` on port 5434 | Docker Desktop is not running, or `docker compose up -d db` was not run |
| The page says the server cannot be reached | The API is not running: `python manage.py runserver` in `rest-erpemployes` |
| Signed out after a page reload | `.env` must have `REFRESH_COOKIE_SECURE=False` (local HTTP) |
| The AI service is unavailable | `LLM_PROVIDER=gemini` without a valid key: set `LLM_PROVIDER=fake` or add the key |
