from ingestion.base import BaseConnector, RawRecordInput


class RegistroColaboradoresConnector(BaseConnector):
    source_name = "registro_colaboradores"

    def fetch(self, **kwargs) -> list[RawRecordInput]:
        raise RuntimeError("REGISTRO_COLABORADORES_URL no configurado. Pendiente definir dataset oficial de transferencias.")

    def normalize(self, raw_record: RawRecordInput):
        raise NotImplementedError("Normalizador Registro Colaboradores pendiente de fixtures oficiales.")
