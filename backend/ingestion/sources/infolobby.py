import csv
import re
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from ingestion.base import BaseConnector, NormalizedEntity, NormalizedGraph, NormalizedRelationship, RawRecordInput
from ingestion.normalizers import canonicalize_name, normalize_rut


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "infolobby"
INFOLOBBY_LICENSE = "InfoLobby / Consejo para la Transparencia"
INFOLOBBY_SOURCE_URL = "https://www.infolobby.cl/"

CSV_FILES = (
    "audiencias.csv",
    "datosAudiencia.csv",
    "pasivos.csv",
    "asistenciasPasivos.csv",
    "activos.csv",
    "asistenciasActivos.csv",
    "representaciones.csv",
    "trabajaPara.csv",
    "otrosAsistentes.csv",
    "viajes.csv",
    "donativos.csv",
)


class InfoLobbyConnector(BaseConnector):
    source_name = "infolobby"

    def fetch(self, **kwargs) -> list[RawRecordInput]:
        return list(self.iter_fetch(**kwargs))

    def iter_fetch(self, **kwargs) -> Iterable[RawRecordInput]:
        data_dir = Path(kwargs.get("data_dir") or DEFAULT_DATA_DIR)
        files = _selected_files(kwargs.get("files"))
        for file_name in files:
            path = data_dir / file_name
            if not path.exists():
                raise FileNotFoundError(f"No existe CSV InfoLobby: {path}")
            yield from _read_csv_records(path)

    def normalize(self, raw_record: RawRecordInput) -> NormalizedGraph:
        file_name = raw_record.payload["_file"]
        row = raw_record.payload["row"]
        if file_name == "audiencias.csv":
            return self._normalize_audience(row, raw_record)
        if file_name == "datosAudiencia.csv":
            return self._normalize_audience_details(row, raw_record)
        if file_name == "pasivos.csv":
            return self._normalize_passive(row, raw_record)
        if file_name == "asistenciasPasivos.csv":
            return self._normalize_passive_attendance(row, raw_record)
        if file_name == "activos.csv":
            return self._normalize_active(row, raw_record)
        if file_name == "asistenciasActivos.csv":
            return self._normalize_active_attendance(row, raw_record)
        if file_name == "representaciones.csv":
            return self._normalize_representation(row, raw_record)
        if file_name == "trabajaPara.csv":
            return self._normalize_employment(row, raw_record)
        if file_name == "otrosAsistentes.csv":
            return self._normalize_other_attendee(row, raw_record)
        if file_name == "viajes.csv":
            return self._normalize_trip(row, raw_record)
        if file_name == "donativos.csv":
            return self._normalize_gift(row, raw_record)
        raise ValueError(f"CSV InfoLobby no soportado: {file_name}")

    def _normalize_audience(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        audience_key, audience = _audience_entity(row.get("CodigoURI"), row)
        organism_key, organism = _organism_entity(row.get("uriOrganismo") or row.get("IDORPortal"), row.get("organismo"))
        relationships = []
        if organism:
            relationships.append(
                NormalizedRelationship(
                    organism_key,
                    audience_key,
                    "registered_lobby_audience",
                    "Organismo registra audiencia",
                    metadata=_metadata(row, raw),
                )
            )
        return _graph(raw, [entity for entity in (audience, organism) if entity], relationships, row.get("CodigoURI"), "audience")

    def _normalize_audience_details(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        audience_key, audience = _audience_entity(row.get("CodigoURI"), row)
        audience.metadata.update(
            {
                "observations": _blank_none(row.get("observaciones")),
                "description": _blank_none(row.get("descripcion")),
                "matter": _blank_none(row.get("materia")),
                "year": _blank_none(row.get("anio")),
                "quarter": _blank_none(row.get("trimestre")),
                "cut": _blank_none(row.get("CUT")),
            }
        )
        return _graph(raw, [audience], [], row.get("CodigoURI"), "audience_details")

    def _normalize_passive(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        passive_key, passive = _person_entity(
            "passive",
            row.get("codigoPersona") or row.get("codigoPasivo"),
            row.get("nombrePasivo"),
            "public_official",
            extra_identifiers=[("INFOLOBBY_PASSIVE_CODE", row.get("codigoPasivo"))],
            metadata={"role": _blank_none(row.get("cargo")), "starts_at": _blank_none(row.get("inicioPasivo")), "ends_at": _blank_none(row.get("finPasivo"))},
        )
        organism_key, organism = _organism_entity(row.get("IDORPortal"), row.get("organismo"))
        relationships = []
        if organism:
            relationships.append(
                NormalizedRelationship(
                    passive_key,
                    organism_key,
                    "holds_public_role",
                    "Sujeto pasivo cumple rol publico",
                    metadata=_metadata(row, raw),
                )
            )
        return _graph(raw, [entity for entity in (passive, organism) if entity], relationships, row.get("codigoPasivo"), "passive")

    def _normalize_passive_attendance(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        passive_key, passive = _person_entity(
            "passive",
            row.get("codigoPasivo"),
            row.get("pasivo"),
            "public_official",
            extra_identifiers=[("INFOLOBBY_PASSIVE_CODE", row.get("codigoPasivo"))],
            metadata={"role": _blank_none(row.get("cargo"))},
        )
        audience_key, audience = _audience_entity(row.get("codigoAudiencia"), row)
        organism_key, organism = _organism_entity(row.get("codigoOrganismo"), row.get("organismo"))
        relationships = [
            NormalizedRelationship(
                passive_key,
                audience_key,
                "attended_audience_as_public_official",
                "Autoridad asiste a audiencia",
                metadata=_metadata(row, raw),
            )
        ]
        if organism:
            relationships.append(NormalizedRelationship(passive_key, organism_key, "holds_public_role", "Autoridad pertenece a organismo", metadata=_metadata(row, raw)))
        return _graph(raw, [entity for entity in (passive, audience, organism) if entity], relationships, row.get("codigoAudiencia"), "passive_attendance")

    def _normalize_active(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        active_key, active = _person_entity(
            "active",
            row.get("CodigoURIPersona") or _tail(row.get("uriActivo")),
            row.get("nombreActivo") or row.get("nombre"),
            "person",
            extra_identifiers=[("INFOLOBBY_ACTIVE_URI", row.get("uriActivo"))],
            metadata={"active_type": _blank_none(row.get("tipoActivo")), "profile_url": _blank_none(row.get("fichaActivoInfoLobby"))},
            risk_score=20,
        )
        audience_key, audience = _audience_entity(_tail(row.get("uriAudiencia")), row)
        organism_key, organism = _organism_entity(row.get("IDORPortal") or row.get("uriOrganismo"), row.get("organismo"))
        relationships = [
            NormalizedRelationship(active_key, audience_key, "attended_lobby_audience", "Sujeto activo asiste a audiencia", metadata=_metadata(row, raw))
        ]
        if organism:
            relationships.append(NormalizedRelationship(organism_key, audience_key, "registered_lobby_audience", "Organismo registra audiencia", metadata=_metadata(row, raw)))
        return _graph(raw, [entity for entity in (active, audience, organism) if entity], relationships, _tail(row.get("uriActivo")), "active")

    def _normalize_active_attendance(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        active_key, active = _person_entity("active", row.get("codigoActivo"), row.get("activo"), "person", risk_score=20)
        audience_key, audience = _audience_entity(row.get("codigoAudiencia"), row)
        entities = [active, audience]
        relationships = [NormalizedRelationship(active_key, audience_key, "attended_lobby_audience", "Sujeto activo asiste a audiencia", metadata=_metadata(row, raw))]
        represented_key, represented = _organization_or_person_entity("represented", row.get("codigoRepresentado"), row.get("representado"), row.get("giroRepresentado"))
        if represented:
            entities.append(represented)
            relationships.append(NormalizedRelationship(active_key, represented_key, "represents_in_audience", "Sujeto activo representa interes", metadata=_metadata(row, raw)))
            relationships.append(NormalizedRelationship(represented_key, audience_key, "represented_in_audience", "Interes representado en audiencia", metadata=_metadata(row, raw)))
        employer_key, employer = _organization_or_person_entity("lobby_employer", row.get("uriEmpLobby"), row.get("empresaLobby"), None)
        if employer:
            entities.append(employer)
            relationships.append(NormalizedRelationship(active_key, employer_key, "works_for", "Sujeto activo trabaja para empleador", metadata=_metadata(row, raw)))
        return _graph(raw, entities, relationships, row.get("codigoAudiencia"), "active_attendance")

    def _normalize_representation(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        represented_key, represented = _organization_or_person_entity("represented", row.get("codigoRepresentado"), row.get("representado"), row.get("giroRepresentado"))
        audience_key, audience = _audience_entity(row.get("codigoAudiencia"), row)
        relationships = []
        if represented:
            represented.metadata["legal_personality"] = _blank_none(row.get("personalidad"))
            relationships.append(
                NormalizedRelationship(
                    represented_key,
                    audience_key,
                    "represented_in_audience",
                    "Interes representado en audiencia",
                    metadata=_metadata(row, raw),
                )
            )
        return _graph(raw, [entity for entity in (represented, audience) if entity], relationships, row.get("codigoAudiencia"), "representation")

    def _normalize_employment(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        employer_key, employer = _organization_or_person_entity("lobby_employer", row.get("codigoEmpLobby"), row.get("empresaLobby"), None)
        active_key, active = _person_entity(
            "active",
            row.get("codigoActivo"),
            row.get("activo"),
            "person",
            metadata={"active_type": _blank_none(row.get("tipoActivo"))},
            risk_score=20,
        )
        audience_key, audience = _audience_entity(row.get("codigoAudiencia"), row)
        relationships = [NormalizedRelationship(active_key, audience_key, "attended_lobby_audience", "Sujeto activo asiste a audiencia", metadata=_metadata(row, raw))]
        if employer:
            relationships.append(NormalizedRelationship(active_key, employer_key, "works_for", "Sujeto activo trabaja para empleador", metadata=_metadata(row, raw)))
        return _graph(raw, [entity for entity in (employer, active, audience) if entity], relationships, row.get("codigoAudiencia"), "employment")

    def _normalize_other_attendee(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        attendee_key, attendee = _person_entity("other_attendee", row.get("asistente"), row.get("asistente"), "person")
        audience_key, audience = _audience_entity(row.get("codigoAudiencia"), row)
        relationships = [
            NormalizedRelationship(attendee_key, audience_key, "attended_audience_other", "Asistente no oficial a audiencia", metadata=_metadata(row, raw))
        ]
        return _graph(raw, [attendee, audience], relationships, row.get("codigoAudiencia"), "other_attendee")

    def _normalize_trip(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        passive_key, passive = _person_entity(
            "passive",
            row.get("codigoPasivo"),
            row.get("pasivo"),
            "public_official",
            extra_identifiers=[("INFOLOBBY_PASSIVE_CODE", row.get("codigoPasivo"))],
            metadata={"role": _blank_none(row.get("cargo"))},
        )
        organism_key, organism = _organism_entity(row.get("IdOrPortal"), row.get("organismo"))
        trip_key = f"infolobby:trip:{_clean_code(row.get('codigoViaje'))}"
        trip = NormalizedEntity(
            key=trip_key,
            name=f"Viaje InfoLobby {row.get('codigoViaje')}",
            entity_type="trip",
            external_id=trip_key,
            identifiers=[("INFOLOBBY_TRIP_CODE", _clean_code(row.get("codigoViaje")))],
            metadata={**_metadata(row, raw), "destination": _blank_none(row.get("destino")), "cost": _number(row.get("costo"))},
            risk_score=_risk_from_amount(row.get("costo")),
        )
        entities = [entity for entity in (passive, organism, trip) if entity]
        relationships = [NormalizedRelationship(passive_key, trip_key, "took_trip", "Autoridad registra viaje", metadata=_metadata(row, raw))]
        if organism:
            relationships.append(NormalizedRelationship(passive_key, organism_key, "holds_public_role", "Autoridad pertenece a organismo", metadata=_metadata(row, raw)))
        for financier in _split_financiers(row.get("financistas")):
            financier_key, financier_entity = _organization_or_person_entity("trip_financier", financier, financier, None)
            entities.append(financier_entity)
            relationships.append(NormalizedRelationship(financier_key, trip_key, "financed_trip", "Entidad financia viaje", metadata=_metadata(row, raw)))
        return _graph(raw, entities, relationships, row.get("codigoViaje"), "trip")

    def _normalize_gift(self, row: dict[str, str], raw: RawRecordInput) -> NormalizedGraph:
        passive_key, passive = _person_entity(
            "passive",
            row.get("codigoPasivo"),
            row.get("pasivo"),
            "public_official",
            extra_identifiers=[("INFOLOBBY_PASSIVE_CODE", row.get("codigoPasivo"))],
            metadata={"role": _blank_none(row.get("cargo"))},
        )
        organism_key, organism = _organism_entity(row.get("IdOrPortal"), row.get("organismo"))
        gift_key = f"infolobby:gift:{_clean_code(row.get('codigoDonativo'))}"
        gift = NormalizedEntity(
            key=gift_key,
            name=f"Donativo InfoLobby {row.get('codigoDonativo')}",
            entity_type="gift",
            external_id=gift_key,
            identifiers=[("INFOLOBBY_GIFT_CODE", _clean_code(row.get("codigoDonativo")))],
            metadata={**_metadata(row, raw), "description": _blank_none(row.get("descripcion")), "occasion": _blank_none(row.get("ocasion"))},
            risk_score=25,
        )
        relationships = [NormalizedRelationship(passive_key, gift_key, "received_gift", "Autoridad recibe donativo", metadata=_metadata(row, raw))]
        if organism:
            relationships.append(NormalizedRelationship(passive_key, organism_key, "holds_public_role", "Autoridad pertenece a organismo", metadata=_metadata(row, raw)))
        return _graph(raw, [entity for entity in (passive, organism, gift) if entity], relationships, row.get("codigoDonativo"), "gift")


def _selected_files(files: Any) -> tuple[str, ...]:
    if not files:
        return CSV_FILES
    selected = [files] if isinstance(files, str) else list(files)
    normalized = tuple(file if str(file).endswith(".csv") else f"{file}.csv" for file in selected)
    unknown = sorted(set(normalized) - set(CSV_FILES))
    if unknown:
        raise ValueError(f"CSV InfoLobby desconocidos: {', '.join(unknown)}")
    return normalized


def _read_csv_records(path: Path) -> Iterable[RawRecordInput]:
    with path.open("r", encoding="utf-16", newline="") as fh:
        reader = csv.DictReader(fh)
        for row_number, row in enumerate(reader, start=2):
            cleaned = {_clean_header(key): _clean_value(value) for key, value in row.items() if key is not None}
            external_id = _external_id(path.name, cleaned, row_number)
            yield RawRecordInput(
                external_id=external_id,
                source_url=INFOLOBBY_SOURCE_URL,
                payload={"_file": path.name, "_row_number": row_number, "row": cleaned},
            )


def _external_id(file_name: str, row: dict[str, str], row_number: int) -> str:
    candidates_by_file = {
        "audiencias.csv": ("CodigoURI",),
        "datosAudiencia.csv": ("CodigoURI",),
        "pasivos.csv": ("codigoPasivo", "codigoPersona"),
        "asistenciasPasivos.csv": ("codigoAudiencia", "codigoPasivo"),
        "activos.csv": ("uriActivo", "CodigoURIPersona"),
        "asistenciasActivos.csv": ("codigoAudiencia", "codigoActivo"),
        "representaciones.csv": ("codigoAudiencia", "codigoRepresentado"),
        "trabajaPara.csv": ("codigoAudiencia", "codigoActivo"),
        "otrosAsistentes.csv": ("codigoAudiencia", "asistente"),
        "viajes.csv": ("codigoViaje",),
        "donativos.csv": ("codigoDonativo",),
    }
    candidates = candidates_by_file.get(file_name, ())
    for key in candidates:
        if row.get(key):
            return f"{file_name}:{_clean_code(_tail(row[key]))}:{row_number}"
    return f"{file_name}:row:{row_number}"


def _graph(raw: RawRecordInput, entities: list[NormalizedEntity], relationships: list[NormalizedRelationship], external_id: str | None, record_type: str) -> NormalizedGraph:
    return NormalizedGraph(
        entities=[entity for entity in entities if entity],
        relationships=relationships,
        source_name="infolobby",
        source_url=raw.source_url,
        source_external_id=_clean_code(external_id) if external_id else raw.external_id,
        metadata={
            "source_type": "public_dataset",
            "license": INFOLOBBY_LICENSE,
            "record_type": record_type,
            "file": raw.payload.get("_file"),
            "row_number": raw.payload.get("_row_number"),
        },
    )


def _audience_entity(code: str | None, row: dict[str, str]) -> tuple[str, NormalizedEntity]:
    clean = _clean_code(code) or _clean_code(_tail(row.get("uriAudiencia"))) or "unknown"
    key = f"infolobby:audience:{clean}"
    name = f"Audiencia InfoLobby {clean}"
    metadata = {
        "audience_code": clean,
        "event_at": _blank_none(row.get("fechaEvento") or row.get("FechaInicio_Audiencia")),
        "registered_at": _blank_none(row.get("fechaRegistro")),
        "updated_at": _blank_none(row.get("fechaActualizacion")),
        "year": _blank_none(row.get("anio")),
        "quarter": _blank_none(row.get("trimestre")),
    }
    return key, NormalizedEntity(
        key=key,
        name=name,
        entity_type="audience",
        external_id=key,
        identifiers=[("INFOLOBBY_AUDIENCE_CODE", clean)] if clean != "unknown" else [],
        metadata={key: value for key, value in metadata.items() if value},
    )


def _organism_entity(code: str | None, name: str | None) -> tuple[str, NormalizedEntity | None]:
    clean_code = _clean_code(_tail(code))
    clean_name = _blank_none(name)
    if not clean_code and not clean_name:
        return "", None
    key = f"infolobby:organism:{clean_code or canonicalize_name(clean_name)}"
    identifiers = [("INFOLOBBY_ORGANISM_CODE", clean_code)] if clean_code else []
    return key, NormalizedEntity(
        key=key,
        name=clean_name or f"Organismo InfoLobby {clean_code}",
        entity_type="public_body",
        external_id=key,
        identifiers=identifiers,
        metadata={"source_system": "infolobby"},
    )


def _person_entity(
    prefix: str,
    code: str | None,
    name: str | None,
    entity_type: str,
    extra_identifiers: list[tuple[str, str | None]] | None = None,
    metadata: dict[str, Any] | None = None,
    risk_score: int = 0,
) -> tuple[str, NormalizedEntity]:
    clean_code = _clean_code(code)
    clean_name = _blank_none(name)
    stable = clean_code or canonicalize_name(clean_name) or "unknown"
    key = f"infolobby:{prefix}:{stable}"
    identifiers = [(f"INFOLOBBY_{prefix.upper()}_CODE", clean_code)] if clean_code else []
    for scheme, value in extra_identifiers or []:
        clean_value = _clean_code(value)
        if clean_value and (scheme, clean_value) not in identifiers:
            identifiers.append((scheme, clean_value))
    return key, NormalizedEntity(
        key=key,
        name=clean_name or f"Persona InfoLobby {stable}",
        entity_type=entity_type,
        external_id=key,
        identifiers=identifiers,
        metadata={key: value for key, value in (metadata or {}).items() if value},
        risk_score=risk_score,
    )


def _organization_or_person_entity(prefix: str, code: str | None, name: str | None, activity: str | None) -> tuple[str, NormalizedEntity | None]:
    clean_code = _clean_code(code)
    clean_name = _blank_none(name)
    if not clean_code and not clean_name:
        return "", None
    rut = normalize_rut(clean_code)
    stable = rut or clean_code or canonicalize_name(clean_name)
    key = f"infolobby:{prefix}:{stable}"
    identifiers = []
    if clean_code:
        identifiers.append((f"INFOLOBBY_{prefix.upper()}_CODE", clean_code))
    if rut:
        identifiers.append(("CL_RUT", rut))
    return key, NormalizedEntity(
        key=key,
        name=clean_name or f"Entidad InfoLobby {stable}",
        entity_type="company" if rut or clean_code else "person",
        external_id=key,
        identifiers=identifiers,
        metadata={"activity": _blank_none(activity), "source_system": "infolobby"},
        risk_score=20 if prefix in {"represented", "lobby_employer"} else 0,
    )


def _metadata(row: dict[str, str], raw: RawRecordInput) -> dict[str, Any]:
    metadata = {"file": raw.payload.get("_file"), "row_number": raw.payload.get("_row_number")}
    metadata.update({key: value for key, value in row.items() if value})
    return metadata


def _split_financiers(value: str | None) -> list[str]:
    cleaned = _blank_none(value)
    if not cleaned:
        return []
    parts = [part.strip(" -") for part in re.split(r"\s+-\s+", cleaned) if part.strip(" -")]
    return parts or [cleaned.strip(" -")]


def _clean_header(value: str) -> str:
    return value.strip().lstrip("\ufeff")


def _clean_value(value: Any) -> str:
    return str(value or "").replace("\x00", "").strip()


def _clean_code(value: str | None) -> str:
    return _clean_value(value).lstrip("\t").strip()


def _blank_none(value: str | None) -> str | None:
    cleaned = _clean_value(value)
    return cleaned or None


def _tail(value: str | None) -> str:
    cleaned = _clean_code(value)
    if "/" in cleaned:
        return cleaned.rsplit("/", 1)[-1]
    return cleaned


def _number(value: str | None) -> float | None:
    cleaned = _clean_code(value)
    if not cleaned:
        return None
    try:
        return float(cleaned.replace(".", "").replace(",", "."))
    except ValueError:
        return None


def _risk_from_amount(amount: str | None) -> int:
    value = _number(amount) or 0
    if value >= 1_000_000:
        return 35
    if value > 0:
        return 15
    return 0
