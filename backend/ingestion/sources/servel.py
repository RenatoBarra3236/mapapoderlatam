from ingestion.base import BaseConnector, RawRecordInput


class ServelConnector(BaseConnector):
    source_name = "servel"

    def fetch(self, **kwargs) -> list[RawRecordInput]:
        raise RuntimeError("SERVEL_DATA_URL no configurado. Pendiente definir dataset oficial de aportes/candidaturas.")

    def normalize(self, raw_record: RawRecordInput):
        raise NotImplementedError("Normalizador SERVEL pendiente de fixtures oficiales.")
