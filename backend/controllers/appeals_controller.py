"""Appeals controller — receives ARCOPOL requests from affected parties.

Implements the data-subject rights side of Chile's Ley 21.719 (and equivalent
laws in MX/PE/CO): Access, Rectification, Cancellation, Opposition,
Portability, Blocking, plus a "human review of automated decision" channel.

For the hackathon demo, requests are appended to a JSONL log file. In
production this would publish to a ticket queue and notify the DPO.
"""
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path

# Log file lives next to the demo data — gitignored at the data dir level.
_LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "appeals.log.jsonl"

VALID_REQUEST_TYPES = {
    "access", "rectification", "cancellation", "opposition",
    "portability", "blocking", "human_review",
}

VALID_RELATIONS = {"subject", "legal_rep", "affected_company", "other"}


def submit_appeal(case_id: str, payload: dict) -> dict:
    """Validate, persist, and return a confirmation envelope."""
    rtype = (payload.get("request_type") or "").strip().lower()
    relation = (payload.get("relation") or "").strip().lower()
    name = (payload.get("name") or "").strip()
    contact = (payload.get("contact") or "").strip()
    description = (payload.get("description") or "").strip()
    lang = (payload.get("lang") or "es").strip().lower()

    if rtype not in VALID_REQUEST_TYPES:
        raise ValueError(f"invalid request_type: {rtype}")
    if relation not in VALID_RELATIONS:
        raise ValueError(f"invalid relation: {relation}")
    if not name or not contact or not description:
        raise ValueError("name, contact and description are required")
    if len(description) > 4000:
        raise ValueError("description too long (max 4000 chars)")

    ticket_id = f"AP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
    received_at = datetime.now(timezone.utc).isoformat()

    record = {
        "ticket_id": ticket_id,
        "received_at": received_at,
        "case_id": case_id,
        "request_type": rtype,
        "relation": relation,
        "name": name,
        "contact": contact,
        "description": description,
        "lang": lang,
        "status": "received",
    }

    # Append-only log. ensure_ascii=False keeps accents intact for periodistas.
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    return {
        "ticket_id": ticket_id,
        "received_at": received_at,
        "status": "received",
        # Indicative SLA — final SLA depends on jurisdiction (Chile's Ley 21.719
        # sets 30 days; MX/PE/CO have analogous windows).
        "expected_response_days": 30,
    }
