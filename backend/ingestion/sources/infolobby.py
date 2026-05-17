from ingestion.base import BaseConnector, RawRecordInput


class InfoLobbyConnector(BaseConnector):
    source_name = "infolobby"

    def fetch(self, **kwargs) -> list[RawRecordInput]:
        raise RuntimeError("INFOLOBBY_ENDPOINT no configurado. Pendiente definir endpoint/dataset oficial a usar.")

    def normalize(self, raw_record: RawRecordInput):
        raise NotImplementedError("Normalizador InfoLobby pendiente de fixtures oficiales.")
