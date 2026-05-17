import re
import unicodedata


def canonicalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", without_accents).strip().lower()


def normalize_rut(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"[^0-9kK]", "", value)
    if len(cleaned) < 2:
        return None
    body, verifier = cleaned[:-1], cleaned[-1].upper()
    body = str(int(body)) if body.isdigit() else body
    return f"{body}-{verifier}"


def payload_hash(payload: dict) -> str:
    import hashlib
    import json

    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True, default=str).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()
