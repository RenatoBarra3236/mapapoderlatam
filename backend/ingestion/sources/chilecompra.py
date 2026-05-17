import json
import os
from urllib.parse import urlencode
from urllib.request import urlopen

from ingestion.base import BaseConnector, NormalizedEntity, NormalizedGraph, NormalizedRelationship, RawRecordInput
from ingestion.normalizers import normalize_rut


LICITACIONES_URL = "http://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json"
ORDEN_COMPRA_URL = "http://api.mercadopublico.cl/servicios/v1/publico/OrdenCompra.json"

FIXTURE_TENDER = {
    "CodigoExterno": "2424-12-LP24",
    "Nombre": "Servicio de mejoramiento municipal de emergencia",
    "CodigoEstado": 8,
    "Estado": "Adjudicada",
    "Descripcion": "Fixture documentado para pruebas locales; no usar como dato real.",
    "Moneda": "CLP",
    "MontoEstimado": 184500000,
    "Comprador": {
        "CodigoOrganismo": "69070300",
        "NombreOrganismo": "Municipalidad de Providencia",
        "RutUnidad": "69070300-9",
        "CodigoUnidad": "2424",
        "NombreUnidad": "Unidad de Compras",
        "NombreUsuario": "Responsable Demo",
        "RutUsuario": "11111111-1",
        "CargoUsuario": "Comprador",
    },
    "Fechas": {"FechaCreacion": "2024-01-10T12:00:00", "FechaAdjudicacion": "2024-02-02T12:00:00"},
    "Adjudicacion": {"NumeroOferentes": 3, "UrlActa": "https://www.mercadopublico.cl/fixture"},
    "Items": {
        "Cantidad": 1,
        "Listado": [
            {
                "Correlativo": 1,
                "CodigoProducto": 72131702,
                "CodigoCategoria": "72131700",
                "Categoria": "Construccion de obras civiles",
                "NombreProducto": "Mejoramiento municipal",
                "Descripcion": "Obras de mejoramiento",
                "Cantidad": 1,
                "Adjudicacion": {
                    "RutProveedor": "76111000-K",
                    "NombreProveedor": "Constructora Los Andes SpA",
                    "CantidadAdjudicada": 1,
                    "MontoUnitario": 184500000,
                },
            }
        ],
    },
}

FIXTURE_PURCHASE_ORDER = {
    "Codigo": "2424-77-SE24",
    "Nombre": "Orden de compra mejoramiento municipal",
    "CodigoEstado": 6,
    "CodigoLicitacion": "2424-12-LP24",
    "Descripcion": "Fixture documentado para pruebas locales; no usar como dato real.",
    "TipoMoneda": "CLP",
    "TotalNeto": 155042017,
    "PorcentajeIva": 19,
    "Impuestos": 29457983,
    "Total": 184500000,
    "Fechas": {"FechaCreacion": "2024-02-05T12:00:00", "FechaEnvio": "2024-02-06T12:00:00"},
    "Comprador": {
        "CodigoOrganismo": "69070300",
        "NombreOrganismo": "Municipalidad de Providencia",
        "RutUnidad": "69070300-9",
        "CodigoUnidad": "2424",
        "NombreUnidad": "Unidad de Compras",
    },
    "Proveedor": {
        "Codigo": "76111000",
        "Nombre": "Constructora Los Andes SpA",
        "RutSucursal": "76111000-K",
        "Comuna": "Santiago",
        "Region": "Region Metropolitana",
    },
    "Items": {
        "Cantidad": 1,
        "Listado": [
            {
                "Correlativo": 1,
                "CodigoProducto": 72131702,
                "Categoria": "Construccion de obras civiles",
                "EspecificacionComprador": "Mejoramiento municipal",
                "Cantidad": 1,
                "Moneda": "CLP",
                "PrecioNeto": 155042017,
                "Total": 184500000,
            }
        ],
    },
}


class ChileCompraConnector(BaseConnector):
    source_name = "chilecompra"

    def fetch(self, **kwargs) -> list[RawRecordInput]:
        ticket = kwargs.get("ticket") or os.getenv("CHILECOMPRA_TICKET")
        use_fixture = kwargs.get("fixture", False)
        kind = kwargs.get("kind") or "licitaciones"
        codes = _as_list(kwargs.get("codigos") or kwargs.get("codigo"))

        if use_fixture:
            return self._fixture_records(kind)
        if not ticket:
            raise RuntimeError("CHILECOMPRA_TICKET no configurado. La API documentada requiere ticket y codigo.")
        if not codes:
            raise RuntimeError("Debe indicar al menos un codigo de licitacion u orden de compra para ChileCompra.")

        records: list[RawRecordInput] = []
        for code in codes:
            if kind in ("licitaciones", "all"):
                records.extend(self._fetch_endpoint(LICITACIONES_URL, code, ticket, "tender"))
            if kind in ("ordenes_compra", "oc", "all"):
                records.extend(self._fetch_endpoint(ORDEN_COMPRA_URL, code, ticket, "purchase_order"))
        return records

    def normalize(self, raw_record: RawRecordInput) -> NormalizedGraph:
        record_type = raw_record.payload.get("_record_type")
        payload = raw_record.payload.get("record", raw_record.payload)
        if record_type == "purchase_order" or _looks_like_purchase_order(payload):
            return self._normalize_purchase_order(payload, raw_record)
        return self._normalize_tender(payload, raw_record)

    def _fetch_endpoint(self, base_url: str, code: str, ticket: str, record_type: str) -> list[RawRecordInput]:
        params = {"codigo": code, "ticket": ticket}
        url = f"{base_url}?{urlencode(params)}"
        safe_url = f"{base_url}?{urlencode({'codigo': code, 'ticket': '***'})}"
        with urlopen(url, timeout=30) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
        listed = _as_list(response_payload.get("Listado") or response_payload.get("listado"))
        return [
            RawRecordInput(
                _external_id_for(item, record_type),
                safe_url,
                {"_record_type": record_type, "api_response": response_payload, "record": item},
            )
            for item in listed
        ]

    def _fixture_records(self, kind: str) -> list[RawRecordInput]:
        records = []
        if kind in ("licitaciones", "all"):
            records.append(RawRecordInput(FIXTURE_TENDER["CodigoExterno"], None, {"_record_type": "tender", "record": FIXTURE_TENDER}))
        if kind in ("ordenes_compra", "oc", "all"):
            records.append(RawRecordInput(FIXTURE_PURCHASE_ORDER["Codigo"], None, {"_record_type": "purchase_order", "record": FIXTURE_PURCHASE_ORDER}))
        return records

    def _normalize_tender(self, payload: dict, raw_record: RawRecordInput) -> NormalizedGraph:
        source_mode = "real_api" if raw_record.source_url else "fixture"
        tender_code = payload.get("CodigoExterno") or payload.get("Codigo") or raw_record.external_id
        tender_name = payload.get("Nombre") or f"Licitacion {tender_code}"
        buyer = payload.get("Comprador") or {}
        buyer_key, buyer_entity = _buyer_entity(buyer, source_mode)
        tender_key = f"tender:{tender_code}"
        items = _as_list((payload.get("Items") or {}).get("Listado"))
        fechas = payload.get("Fechas") or {}
        adjudication = payload.get("Adjudicacion") or {}

        entities = [
            buyer_entity,
            NormalizedEntity(
                key=tender_key,
                name=tender_name,
                entity_type="tender",
                external_id=tender_code,
                identifiers=[("CHILECOMPRA_TENDER_CODE", tender_code)] if tender_code else [],
                metadata={
                    "description": payload.get("Descripcion"),
                    "status_code": payload.get("CodigoEstado"),
                    "status": payload.get("Estado"),
                    "type": payload.get("Tipo"),
                    "type_code": payload.get("CodigoTipo"),
                    "currency": payload.get("Moneda"),
                    "estimated_amount": payload.get("MontoEstimado"),
                    "claim_count": payload.get("CantidadReclamos"),
                    "reasoned_by_contraloria": payload.get("TomaRazon"),
                    "contract_mode": payload.get("Contrato"),
                    "dates": fechas,
                    "award": adjudication,
                    "items": [_item_metadata(item) for item in items],
                    "source_mode": source_mode,
                    "raw_field_source": "Documentacion-API-Mercado-Publico-Licitaciones.pdf",
                },
                risk_score=_risk_from_amount(payload.get("MontoEstimado")),
            ),
        ]
        relationships = [
            NormalizedRelationship(buyer_key, tender_key, "issued_by", "Organismo comprador publica licitacion", metadata={"source_mode": source_mode})
        ]

        user_name = buyer.get("NombreUsuario")
        user_rut = normalize_rut(buyer.get("RutUsuario"))
        if user_name or user_rut:
            user_key = f"buyer_user:{user_rut or user_name}"
            entities.append(
                NormalizedEntity(
                    key=user_key,
                    name=user_name or f"Responsable {user_rut}",
                    entity_type="person",
                    external_id=user_rut,
                    identifiers=[("CL_RUT", user_rut)] if user_rut else [],
                    metadata={"role": buyer.get("CargoUsuario"), "source_mode": source_mode},
                )
            )
            relationships.append(NormalizedRelationship(user_key, tender_key, "signed", "Responsable de licitacion", metadata={"source_mode": source_mode}))

        awards = []
        for item in items:
            award = item.get("Adjudicacion") or {}
            supplier_name = award.get("NombreProveedor")
            supplier_rut = normalize_rut(award.get("RutProveedor"))
            if not supplier_name and not supplier_rut:
                continue
            supplier_key = f"supplier:{supplier_rut or supplier_name}"
            entities.append(_supplier_entity(supplier_key, supplier_name, supplier_rut, {}, source_mode))
            amount = award.get("MontoUnitario")
            relationships.append(
                NormalizedRelationship(
                    tender_key,
                    supplier_key,
                    "awarded_to",
                    "Linea adjudicada a proveedor",
                    metadata={
                        "amount": amount,
                        "currency": payload.get("Moneda") or "CLP",
                        "quantity_awarded": award.get("CantidadAdjudicada"),
                        "item": _item_metadata(item),
                        "source_mode": source_mode,
                    },
                )
            )
            awards.append({"supplier": supplier_name, "rut": supplier_rut, "amount": amount, "item": item.get("Correlativo")})

        return NormalizedGraph(
            entities=entities,
            relationships=relationships,
            source_name=self.source_name,
            source_url=raw_record.source_url,
            source_external_id=tender_code,
            metadata={"source_type": "public_api", "license": "Mercado Publico / ChileCompra", "record_type": "tender", "source_mode": source_mode, "awards": awards},
        )

    def _normalize_purchase_order(self, payload: dict, raw_record: RawRecordInput) -> NormalizedGraph:
        source_mode = "real_api" if raw_record.source_url else "fixture"
        po_code = payload.get("Codigo") or raw_record.external_id
        po_key = f"purchase_order:{po_code}"
        tender_code = payload.get("CodigoLicitacion")
        buyer = payload.get("Comprador") or {}
        supplier = payload.get("Proveedor") or {}
        buyer_key, buyer_entity = _buyer_entity(buyer, source_mode)
        supplier_rut = normalize_rut(supplier.get("RutSucursal"))
        supplier_key = f"supplier:{supplier_rut or supplier.get('Codigo') or supplier.get('Nombre')}"
        items = _as_list((payload.get("Items") or {}).get("Listado"))

        entities = [
            buyer_entity,
            _supplier_entity(supplier_key, supplier.get("Nombre"), supplier_rut, supplier, source_mode),
            NormalizedEntity(
                key=po_key,
                name=payload.get("Nombre") or f"Orden de compra {po_code}",
                entity_type="purchase_order",
                external_id=po_code,
                identifiers=[("CHILECOMPRA_OC_CODE", po_code)] if po_code else [],
                metadata={
                    "description": payload.get("Descripcion"),
                    "status_code": payload.get("CodigoEstado"),
                    "tender_code": tender_code,
                    "type": payload.get("Tipo"),
                    "type_code": payload.get("CodigoTipo"),
                    "currency": payload.get("TipoMoneda"),
                    "net_total": payload.get("TotalNeto"),
                    "tax_rate": payload.get("PorcentajeIva"),
                    "taxes": payload.get("Impuestos"),
                    "total": payload.get("Total"),
                    "funding": payload.get("Financiamiento"),
                    "payment_method": payload.get("FormaPago"),
                    "shipping_type": payload.get("TipoDespacho"),
                    "dates": payload.get("Fechas") or {},
                    "items": [_purchase_order_item_metadata(item) for item in items],
                    "source_mode": source_mode,
                    "raw_field_source": "Documentacion-API-Mercado-Publico-oc.pdf",
                },
                risk_score=_risk_from_amount(payload.get("Total")),
            ),
        ]
        relationships = [
            NormalizedRelationship(po_key, buyer_key, "issued_by", "Orden emitida por organismo comprador", metadata={"source_mode": source_mode}),
            NormalizedRelationship(po_key, supplier_key, "awarded_to", "Orden de compra a proveedor", metadata={"amount": payload.get("Total"), "currency": payload.get("TipoMoneda") or "CLP", "source_mode": source_mode}),
            NormalizedRelationship(buyer_key, supplier_key, "purchased_from", "Organismo compra a proveedor", metadata={"purchase_order_code": po_code, "amount": payload.get("Total"), "source_mode": source_mode}),
        ]
        if tender_code:
            tender_key = f"tender:{tender_code}"
            entities.append(
                NormalizedEntity(
                    key=tender_key,
                    name=f"Licitacion {tender_code}",
                    entity_type="tender",
                    external_id=tender_code,
                    identifiers=[("CHILECOMPRA_TENDER_CODE", tender_code)],
                    metadata={"source_mode": source_mode},
                )
            )
            relationships.append(NormalizedRelationship(po_key, tender_key, "related_to", "Orden asociada a licitacion", metadata={"source_mode": source_mode}))

        return NormalizedGraph(
            entities=entities,
            relationships=relationships,
            source_name=self.source_name,
            source_url=raw_record.source_url,
            source_external_id=po_code,
            metadata={"source_type": "public_api", "license": "Mercado Publico / ChileCompra", "record_type": "purchase_order", "source_mode": source_mode},
        )


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _external_id_for(item: dict, record_type: str) -> str | None:
    if record_type == "purchase_order":
        return item.get("Codigo")
    return item.get("CodigoExterno") or item.get("Codigo")


def _looks_like_purchase_order(payload: dict) -> bool:
    return "Proveedor" in payload or "TotalNeto" in payload or "CodigoLicitacion" in payload


def _buyer_entity(buyer: dict, source_mode: str) -> tuple[str, NormalizedEntity]:
    rut = normalize_rut(buyer.get("RutUnidad"))
    organism_code = buyer.get("CodigoOrganismo")
    unit_code = buyer.get("CodigoUnidad")
    key = f"buyer:{rut or organism_code or buyer.get('NombreOrganismo')}"
    identifiers = []
    if rut:
        identifiers.append(("CL_RUT", rut))
    if organism_code:
        identifiers.append(("CHILECOMPRA_ORGANISM_CODE", str(organism_code)))
    if unit_code:
        identifiers.append(("CHILECOMPRA_UNIT_CODE", str(unit_code)))
    return key, NormalizedEntity(
        key=key,
        name=buyer.get("NombreOrganismo") or buyer.get("NombreUnidad") or "Organismo comprador no informado",
        entity_type="public_body",
        external_id=rut or organism_code,
        identifiers=identifiers,
        metadata={
            "unit_name": buyer.get("NombreUnidad"),
            "activity": buyer.get("Actividad"),
            "address": buyer.get("DireccionUnidad"),
            "commune": buyer.get("ComunaUnidad"),
            "region": buyer.get("RegionUnidad"),
            "country": buyer.get("Pais"),
            "contact_name": buyer.get("NombreContacto"),
            "contact_role": buyer.get("CargoContacto"),
            "source_mode": source_mode,
        },
    )


def _supplier_entity(key: str, name: str | None, rut: str | None, supplier_payload: dict, source_mode: str) -> NormalizedEntity:
    identifiers = []
    if rut:
        identifiers.append(("CL_RUT", rut))
    if supplier_payload.get("Codigo"):
        identifiers.append(("CHILECOMPRA_SUPPLIER_ID", str(supplier_payload["Codigo"])))
    return NormalizedEntity(
        key=key,
        name=name or supplier_payload.get("Nombre") or f"Proveedor {rut}",
        entity_type="company",
        external_id=rut or supplier_payload.get("Codigo"),
        identifiers=identifiers,
        metadata={
            "activity": supplier_payload.get("Actividad"),
            "branch_code": supplier_payload.get("CodigoSucursal"),
            "branch_name": supplier_payload.get("NombreSucursal"),
            "commune": supplier_payload.get("Comuna"),
            "region": supplier_payload.get("Region"),
            "country": supplier_payload.get("Pais"),
            "source_mode": source_mode,
        },
        risk_score=25,
    )


def _item_metadata(item: dict) -> dict:
    return {
        "correlative": item.get("Correlativo"),
        "product_code": item.get("CodigoProducto"),
        "category_code": item.get("CodigoCategoria"),
        "category": item.get("Categoria"),
        "product_name": item.get("NombreProducto"),
        "description": item.get("Descripcion"),
        "unit": item.get("UnidadMedida"),
        "quantity": item.get("Cantidad"),
    }


def _purchase_order_item_metadata(item: dict) -> dict:
    return {
        "correlative": item.get("Correlativo"),
        "product_code": item.get("CodigoProducto"),
        "category_code": item.get("CodigoCategoria"),
        "category": item.get("Categoria"),
        "buyer_spec": item.get("EspecificacionComprador"),
        "supplier_spec": item.get("EspecificacionProveedor"),
        "quantity": item.get("Cantidad"),
        "currency": item.get("Moneda"),
        "net_price": item.get("PrecioNeto"),
        "charges": item.get("TotalCargos"),
        "discounts": item.get("TotalDescuentos"),
        "taxes": item.get("TotalImpuestos"),
        "total": item.get("Total"),
    }


def _risk_from_amount(amount) -> int:
    try:
        amount = float(amount or 0)
    except (TypeError, ValueError):
        return 0
    if amount >= 1_000_000_000:
        return 70
    if amount >= 100_000_000:
        return 45
    if amount > 0:
        return 20
    return 0
