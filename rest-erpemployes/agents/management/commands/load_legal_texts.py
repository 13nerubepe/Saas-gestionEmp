import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from agents.services import load_legal_references

FORMAT_HELP = """
Each file is JSON. Top-level fields are defaults for every article; an article
may override them:

{
  "jurisdiction": "CM",
  "source_url": "https://...",
  "effective_date": "1992-08-14",
  "articles": [
    {"citation": "Code du travail, art. 28", "title": "...", "content": "..."}
  ]
}
"""


class Command(BaseCommand):
    help = "Load or update legal texts and compute their embeddings." + FORMAT_HELP

    def add_arguments(self, parser):
        parser.add_argument("files", nargs="+", type=Path)

    def handle(self, *args, files, **options):
        for path in files:
            articles = self._read(path)
            created, updated, embedded = load_legal_references(articles)
            self.stdout.write(
                self.style.SUCCESS(
                    f"{path.name}: {created} created, {updated} updated, {embedded} embedded"
                )
            )

    def _read(self, path):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f"{path}: {exc}") from exc

        defaults = {key: value for key, value in data.items() if key != "articles"}
        articles = [defaults | article for article in data.get("articles", [])]
        for number, article in enumerate(articles, start=1):
            missing = {"jurisdiction", "citation", "content"} - article.keys()
            if missing:
                raise CommandError(f"{path}, article {number}: missing {sorted(missing)}")
        return articles
