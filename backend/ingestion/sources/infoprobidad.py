from ingestion.base import BaseConnector, RawRecordInput


class InfoProbidadConnector(BaseConnector):
    source_name = "infoprobidad"

    def fetch(self, **kwargs) -> list[RawRecordInput]:
        raise RuntimeError("INFOPROBIDAD_ENDPOINT no configurado. Pendiente definir acceso oficial a declaraciones.")

    def normalize(self, raw_record: RawRecordInput):
        raise NotImplementedError("Normalizador InfoProbidad pendiente de fixtures oficiales.")
