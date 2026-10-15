# Contributing

Product context, architecture and the reasons behind these rules are in
[.claude/CLAUDE.md](.claude/CLAUDE.md). This page is the day-to-day checklist.

## Backend setup

Requires Python 3.13 and Docker.

```
docker compose up -d db

cd rest-erpemployes
python -m venv venv
venv\Scripts\activate            # Windows; on macOS/Linux: source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env             # then set SECRET_KEY
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

PostgreSQL listens on host port **5434** (5432 and 5433 are often taken by
other local servers). Tests need it: vector search does not exist in SQLite.

To try the legal agent, put a Gemini key in `.env` (`GEMINI_API_KEY`, free at
https://aistudio.google.com/), then load texts:

```
python manage.py load_legal_texts path/to/texts.json
```

`python manage.py help load_legal_texts` shows the file format. Without a key,
set `LLM_PROVIDER=fake` to exercise the whole flow with canned answers.

- API: http://localhost:8000/api/v1/
- Interactive API docs: http://localhost:8000/api/docs/
- Admin: http://localhost:8000/admin/

Once, at the repository root: `pre-commit install`.

To run the API in Docker instead of a venv: `docker compose up`.

## Before opening a pull request

From `rest-erpemployes/`:

```
ruff check .
ruff format .
python manage.py makemigrations --check --dry-run
pytest
```

CI runs the same four commands and must be green to merge.

## Git

- Never push to `main`. Open a pull request; one approval is required.
- One short-lived branch per story, merged within a day or two:
  `feature/US-03-client-record`, `fix/...`, `chore/...`.
- Keep pull requests small (around 400 changed lines at most) and put the
  story id in the title.
- Code, comments, commits and branch names are in English.

### Migrations

Migrations are the most common source of conflicts.

- Rebase on `main` before running `makemigrations`.
- Never edit a migration that is already merged; add a new one.
- Commit the migration in the same pull request as the model change.

## Adding a backend app

Every app has the same layout. Use `accounts` as the reference.

```
<app>/
  models.py        data; business models inherit from core.models.CompanyOwnedModel
  services.py      writes and business rules
  selectors.py     non-trivial reads (add when needed)
  serializers.py   API input / output
  views.py         thin: validate, call a service, respond
  urls.py          included from config/urls.py under /api/v1/
  admin.py
  tests/           factories.py, test_*.py
```

Rules that keep the code easy to change:

- **Views hold no business logic.** If a rule could be triggered from somewhere
  else (a scheduled task, an agent), it belongs in `services.py`.
- **Company data is scoped by `accounts.tenancy.CompanyScopedMixin`.** Never
  filter on the company by hand in a view, and never accept `company` from the
  request body.
- **Every view declares its permissions.** The default is authenticated-only.
- **No user-facing string is hard-coded.** Wrap it in `gettext`.
- **Business apps may import `accounts` and `agents`, never the reverse.**
- **Tests never call a real LLM.**

## API contract

The OpenAPI schema at `/api/schema/` is the contract between backend and
frontend. When an endpoint changes, the schema changes in the same pull
request, and the frontend regenerates its TypeScript types from it.

The active company is sent in the `X-Company-ID` header. It may be omitted
when the user belongs to a single company.

Authentication: `POST /api/v1/auth/login/` returns an `access` token to send
as `Authorization: Bearer <token>`. The refresh token is an httpOnly cookie:
call `POST /api/v1/auth/refresh/` with `withCredentials: true` when the access
token expires (15 minutes). Errors carry a stable `code` (e.g.
`not_authenticated`, `llm_unavailable`) to translate on the client.
