# Production image by default (gunicorn, runtime dependencies only).
# Local development builds it with REQUIREMENTS=requirements-dev.txt and runs
# runserver instead (see docker-compose.yml at the repository root).
FROM python:3.13-slim

ARG REQUIREMENTS=requirements.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r ${REQUIREMENTS}

COPY . .

# Static files are collected at build time; settings need dummy values here.
RUN SECRET_KEY=build-only DATABASE_URL=sqlite:///:memory: python manage.py collectstatic --noinput

# Not root inside the container.
RUN useradd --create-home --uid 1000 app && chown -R app /app
USER app

EXPOSE 8000

# 2 workers fit a 1 GB server; the timeout covers a slow AI answer.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "90", "--access-logfile", "-"]
