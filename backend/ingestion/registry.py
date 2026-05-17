from ingestion.sources.chilecompra import ChileCompraConnector
from ingestion.sources.infolobby import InfoLobbyConnector
from ingestion.sources.infoprobidad import InfoProbidadConnector
from ingestion.sources.registro_colaboradores import RegistroColaboradoresConnector
from ingestion.sources.servel import ServelConnector


CONNECTORS = {
    "chilecompra": ChileCompraConnector,
    "infolobby": InfoLobbyConnector,
    "infoprobidad": InfoProbidadConnector,
    "registro_colaboradores": RegistroColaboradoresConnector,
    "servel": ServelConnector,
}


def get_connector(name: str):
    try:
        return CONNECTORS[name]()
    except KeyError as exc:
        raise ValueError(f"Conector no registrado: {name}") from exc
