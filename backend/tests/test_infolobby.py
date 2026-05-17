from ingestion.base import BaseConnector, NormalizedGraph, RawRecordInput
from ingestion.runners import run_connector
from ingestion.sources import infolobby
from ingestion.sources.infolobby import InfoLobbyConnector
from models import IngestionRun


def _write_utf16_csv(path, header, rows):
    content = ",".join(header) + "\n"
    content += "\n".join(",".join(row) for row in rows)
    path.write_text(content, encoding="utf-16")


def test_infolobby_reads_utf16_csv_and_cleans_codes(tmp_path):
    _write_utf16_csv(
        tmp_path / "trabajaPara.csv",
        ["codigoEmpLobby", "empresaLobby", "codigoActivo", "activo", "tipoActivo", "codigoAudiencia"],
        [["\t760321079r", "FDD INNOVACION S.A", "abc123", "MARCELO AMENGUAL", "Gestor", "ad009162771"]],
    )

    raw = next(InfoLobbyConnector().iter_fetch(data_dir=tmp_path, files=["trabajaPara"]))

    assert raw.payload["_file"] == "trabajaPara.csv"
    assert raw.payload["row"]["codigoEmpLobby"] == "760321079r"
    assert raw.external_id == "trabajaPara.csv:ad009162771:2"


def test_infolobby_normalizes_active_attendance_with_represented_and_employer():
    raw = RawRecordInput(
        "asistenciasActivos.csv:aq0012423391:2",
        "https://www.infolobby.cl/",
        {
            "_file": "asistenciasActivos.csv",
            "_row_number": 2,
            "row": {
                "codigoActivo": "00002e5e7cc805073870ceff02c27077",
                "activo": "ricardo santi liempi",
                "uriEmpLobby": "760321079r",
                "empresaLobby": "Empresa Lobby SPA",
                "codigoAudiencia": "aq0012423391",
                "codigoRepresentado": "760977594r",
                "representado": "Andes Iron SPA",
                "giroRepresentado": "Mineria",
            },
        },
    )

    graph = InfoLobbyConnector().normalize(raw)

    assert {entity.entity_type for entity in graph.entities} >= {"person", "audience", "company"}
    assert any(("CL_RUT", "76097759-4") in entity.identifiers for entity in graph.entities)
    assert {rel.relationship_type for rel in graph.relationships} >= {
        "attended_lobby_audience",
        "represents_in_audience",
        "represented_in_audience",
        "works_for",
    }
    assert graph.metadata["source_type"] == "public_dataset"


def test_infolobby_normalizes_trip_financiers():
    raw = RawRecordInput(
        "viajes.csv:co00112:2",
        "https://www.infolobby.cl/",
        {
            "_file": "viajes.csv",
            "_row_number": 2,
            "row": {
                "codigoViaje": "co00112",
                "destino": "Valparaiso",
                "pasivo": "Lorena Fries Monleon",
                "codigoPasivo": "CO001CO001-SP001",
                "organismo": "INSTITUTO NACIONAL DE DERECHOS HUMANOS",
                "IdOrPortal": "co001",
                "cargo": "Consejero",
                "fechaInicio": "2015-07-21",
                "fechaTermino": "2015-07-21",
                "descripcion": "Sesion",
                "costo": "41795",
                "financistas": "   Instituto Nacional de Derechos Humanos - ",
            },
        },
    )

    graph = InfoLobbyConnector().normalize(raw)

    assert any(entity.entity_type == "trip" for entity in graph.entities)
    assert any(rel.relationship_type == "took_trip" for rel in graph.relationships)
    assert any(rel.relationship_type == "financed_trip" for rel in graph.relationships)


def test_infolobby_normalizes_gift_without_inventing_donor():
    raw = RawRecordInput(
        "donativos.csv:co001donativo-013:2",
        "https://www.infolobby.cl/",
        {
            "_file": "donativos.csv",
            "_row_number": 2,
            "row": {
                "codigoDonativo": "co001donativo-013",
                "descripcion": "Libro",
                "pasivo": "Lorena Fries Monleon",
                "codigoPasivo": "CO001CO001-SP001",
                "organismo": "INSTITUTO NACIONAL DE DERECHOS HUMANOS",
                "IdOrPortal": "co001",
                "cargo": "Consejero",
                "fechaDonativo": "2014-12-22",
                "ocasion": "Obsequio institucional",
            },
        },
    )

    graph = InfoLobbyConnector().normalize(raw)

    assert any(entity.entity_type == "gift" for entity in graph.entities)
    assert any(rel.relationship_type == "received_gift" for rel in graph.relationships)
    assert not any("donor" in rel.relationship_type for rel in graph.relationships)


class _StreamingConnector(BaseConnector):
    source_name = "streaming_test"

    def fetch(self, **kwargs):
        raise AssertionError("run_connector should use iter_fetch")

    def iter_fetch(self, **kwargs):
        for idx in range(5):
            yield RawRecordInput(str(idx), None, {"idx": idx})

    def normalize(self, raw_record):
        return NormalizedGraph(source_name=self.source_name)


class _FakeSession:
    def __init__(self):
        self.run = None
        self.commits = 0

    def add(self, value):
        if isinstance(value, IngestionRun):
            value.id = 1
            value.records_fetched = value.records_fetched or 0
            value.records_processed = value.records_processed or 0
            value.records_failed = value.records_failed or 0
            self.run = value

    def commit(self):
        self.commits += 1

    def flush(self):
        pass

    def rollback(self):
        pass

    def expunge_all(self):
        pass

    def get(self, model, pk):
        return self.run


def test_run_connector_streams_with_limit_and_batches(monkeypatch):
    session = _FakeSession()
    monkeypatch.setattr(infolobby, "INFOLOBBY_SOURCE_URL", "https://www.infolobby.cl/")
    monkeypatch.setattr("ingestion.runners.persist_graph", lambda db, graph: 0)

    run = run_connector(session, _StreamingConnector(), limit=3, batch_size=2)

    assert run.records_fetched == 3
    assert run.records_processed == 3
    assert run.records_failed == 0
    assert session.commits >= 3
