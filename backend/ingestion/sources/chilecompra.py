import json
import os
from urllib.parse import urlencode
from urllib.request import urlopen

from ingestion.base import BaseConnector, NormalizedEntity, NormalizedGraph, NormalizedRelationship, RawRecordInput
from ingestion.normalizers import normalize_rut


FIXTURE_TENDER = {
    "CodigoExterno": "2424-12-LP24",
    "Nombre": "Servicio de mejoramiento municipal de emergencia",
    "CodigoEstado": 8,
    "Comprador": {"NombreOrganismo": "Municipalidad de Providencia", "RutUnidad": "69070300-9"},
    "Items": {
        "Listado": [
            {
                "Adjudicacion": {
                    "RutProveedor": "76111000-K",
                    "NombreProveedor": "Constructora Los Andes SpA",
                    "MontoUnitario": 184500000,
                }
            }
        ]
    },
}


class ChileCompraConnector(BaseConnector):
    source_name = "chilecompra"
    base_url = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json"

    def fetch(self, **kwargs) -> list[RawRecordInput]:
        ticket = kwargs.get("ticket") or os.getenv("CHILECOMPRA_TICKET")
        use_fixture = kwargs.get("fixture", False)
        if not ticket:
            if use_fixture:
                return [RawRecordInput(FIXTURE_TENDER["CodigoExterno"], None, FIXTURE_TENDER)]
            raise RuntimeError("CHILECOMPRA_TICKET no configurado. Use fixture=True solo para desarrollo.")

        params = {"ticket": ticket}
        if kwargs.get("codigo"):
            params["codigo"] = kwargs["codigo"]
        if kwargs.get("fecha"):
            params["fecha"] = kwargs["fecha"]
        url = f"{self.base_url}?{urlencode(params)}"
        with urlopen(url, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        items = payload.get("Listado") or payload.get("listado") or []
        return [
            RawRecordInput(item.get("CodigoExterno") or item.get("Codigo"), url, item)
            for item in items
        ]

    def normalize(self, raw_record: RawRecordInput) -> NormalizedGraph:
        payload = raw_record.payload
        tender_code = payload.get("CodigoExterno") or payload.get("Codigo") or raw_record.external_id
        tender_name = payload.get("Nombre") or f"Licitacion {tender_code}"
        buyer = payload.get("Comprador") or {}
        buyer_name = buyer.get("NombreOrganismo") or buyer.get("NombreUnidad") or "Organismo comprador no informado"
        buyer_rut = normalize_rut(buyer.get("RutUnidad") or buyer.get("RutOrganismo"))

        entities = [
            NormalizedEntity(
                key="buyer",
                name=buyer_name,
                entity_type="public_body",
                external_id=buyer_rut,
                identifiers=[("CL_RUT", buyer_rut)] if buyer_rut else [],
                metadata={"source_mode": "real_api" if raw_record.source_url else "fixture"},
            ),
            NormalizedEntity(
                key="tender",
                name=tender_name,
                entity_type="tender",
                external_id=tender_code,
                identifiers=[("CHILECOMPRA_TENDER_CODE", tender_code)] if tender_code else [],
                metadata={"raw_status": payload.get("CodigoEstado"), "source_mode": "real_api" if raw_record.source_url else "fixture"},
                risk_score=20,
            ),
        ]
        relationships = [
            NormalizedRelationship("buyer", "tender", "issued_by", "Publica licitacion", metadata={"source_mode": "real_api" if raw_record.source_url else "fixture"})
        ]

        awards = []
        listed = ((payload.get("Items") or {}).get("Listado") or [])
        for item in listed:
            adjudication = item.get("Adjudicacion") or {}
            supplier_name = adjudication.get("NombreProveedor")
            supplier_rut = normalize_rut(adjudication.get("RutProveedor"))
            if not supplier_name:
                continue
            supplier_key = f"supplier:{supplier_rut or supplier_name}"
            entities.append(
                NormalizedEntity(
                    key=supplier_key,
                    name=supplier_name,
                    entity_type="company",
                    external_id=supplier_rut,
                    identifiers=[("CL_RUT", supplier_rut)] if supplier_rut else [],
                    metadata={"source_mode": "real_api" if raw_record.source_url else "fixture"},
                    risk_score=35,
                )
            )
            amount = adjudication.get("MontoUnitario") or adjudication.get("MontoTotal")
            relationships.append(
                NormalizedRelationship(
                    "tender",
                    supplier_key,
                    "awarded_to",
                    "Adjudicada a proveedor",
                    weight=1,
                    metadata={"amount": amount, "currency": "CLP", "source_mode": "real_api" if raw_record.source_url else "fixture"},
                )
            )
            awards.append({"supplier": supplier_name, "amount": amount})

        return NormalizedGraph(
            entities=entities,
            relationships=relationships,
            source_name=self.source_name,
            source_url=raw_record.source_url,
            source_external_id=tender_code,
            metadata={"source_type": "public_api", "license": "Mercado Publico / ChileCompra", "awards": awards},
        )
