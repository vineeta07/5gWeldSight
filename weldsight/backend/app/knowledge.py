"""
WeldSight knowledge base: Markdown files in /knowledge, split by heading,
searched with BM25 (fast, no extra services, good for a few dozen pages).
Edit the .md files to change what the assistant knows, then restart.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from . import config

STOP = set(
    "a an and are as at be by can do does for from has have how i if in into is it its me my of on or our "
    "so than that the their them then there these they this to up was we were what when where which who "
    "why will with you your about any also just more most not only other some such".split()
)


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    out = []
    for w in words:
        if w in STOP or len(w) < 2:
            continue
        # tiny stemmer so "cracks"/"cracking" match "crack"
        for suf in ("ing", "es", "s"):
            if len(w) > 4 and w.endswith(suf):
                w = w[: -len(suf)]
                break
        out.append(w)
    return out


@dataclass
class Chunk:
    id: str
    title: str
    source: str
    text: str
    tokens: list[str]


class KnowledgeBase:
    def __init__(self, folder: Path = config.KNOWLEDGE_DIR):
        self.folder = Path(folder)
        self.chunks: list[Chunk] = []
        self.load()

    def load(self) -> None:
        self.chunks = []
        for path in sorted(self.folder.glob("*.md")):
            text = path.read_text(encoding="utf-8")
            parts = re.split(r"^# (.+)$", text, flags=re.M)
            # parts = [preamble, title1, body1, title2, body2, ...]
            for i in range(1, len(parts), 2):
                title, body = parts[i].strip(), parts[i + 1].strip()
                if not body:
                    continue
                cid = f"{path.stem}#{re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')}"
                # title words count double
                self.chunks.append(Chunk(cid, title, path.name, body, tokenize(title) * 2 + tokenize(body)))
        self._index()

    def _index(self) -> None:
        self.N = len(self.chunks)
        self.avgdl = sum(len(c.tokens) for c in self.chunks) / max(1, self.N)
        df = Counter()
        for c in self.chunks:
            df.update(set(c.tokens))
        self.idf = {t: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for t, n in df.items()}
        self.tf = [Counter(c.tokens) for c in self.chunks]

    def search(self, query: str, k: int = 4) -> list[dict]:
        q = tokenize(query)
        if not q or not self.chunks:
            return []
        k1, b = 1.5, 0.75
        scores = []
        for i, c in enumerate(self.chunks):
            tf, dl, s = self.tf[i], len(c.tokens), 0.0
            for t in q:
                if t in tf:
                    s += self.idf.get(t, 0) * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * dl / self.avgdl))
            if s > 0:
                scores.append((s, i))
        scores.sort(reverse=True)
        return [
            {"id": self.chunks[i].id, "title": self.chunks[i].title, "source": self.chunks[i].source, "text": self.chunks[i].text, "score": round(s, 2)}
            for s, i in scores[:k]
        ]

    def get(self, chunk_id: str) -> Chunk | None:
        return next((c for c in self.chunks if c.id == chunk_id), None)


kb = KnowledgeBase()
