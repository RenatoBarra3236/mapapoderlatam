# ChileCompra Rust Selective Ingestion

CLI: `backend/tui-rs`.

## Configuracion

```bash
export CHILECOMPRA_TICKET="..."
export RUST_DATABASE_URL="postgresql://usuario:password@localhost:5432/mapapoderlatam"
```

`DATABASE_URL=postgresql+psycopg://...` tambien sirve; Rust lo normaliza a `postgresql://...`. No se imprime ni persiste el ticket. Las URLs guardadas quedan sanitizadas con `ticket=***`.

## Comandos

Dry-run:

```bash
cargo run -- ingest-chilecompra --fast-demo --dry-run
```

Fast demo:

```bash
cargo run -- ingest-chilecompra --fast-demo --limit 50
```

Keyword:

```bash
cargo run -- ingest-chilecompra --keyword "emergencia" --from 2025-01-01 --to 2025-01-31 --limit 50
```

Comprador:

```bash
cargo run -- ingest-chilecompra --buyer "Municipalidad de Santiago" --from 2025-01-01 --to 2025-01-31 --limit 50
```

Proveedor:

```bash
cargo run -- ingest-chilecompra --supplier-rut "76123456-7" --limit 50
cargo run -- ingest-chilecompra --supplier-name "Constructora" --limit 50
```

Duplicados:

```bash
cargo run -- db-diagnose-duplicates
cargo run -- db-diagnose-duplicates --fix-safe
```

## Cache y rate limit

Defaults: `--max-requests 20`, `--delay-ms 1000`, `--retry 2`, `--backoff-ms 2000`, `--cache-dir .cache/chilecompra`, cache activado.

La CLI imprime `CACHE HIT`, `CACHE MISS` y `API REQUEST`. Si hay cache no repite el request. En 429/5xx reintenta con backoff; en 401/403 aborta.

## Datos guardados

Sources:

- `source_name=chilecompra`
- `source_type=api`
- `source_url` sanitizada
- `external_id` codigo licitacion/OC
- metadata con `institution`, `source_mode=selective_api`, `record_type`, `fetched_at`

Raw records:

- Se guardan por defecto para registros usados.
- `source_name=chilecompra`, `external_id`, `payload_hash`, `payload`, `status=processed`.
- `--skip-raw` o `--raw-mode minimal` evita guardar raw.

Entidades:

- `public_body`
- `company`
- `tender`
- `purchase_order`
- `contract` queda reservado si aparece dato contractual explicito.

Identificadores:

- `CHILECOMPRA_TENDER_CODE`
- `CHILECOMPRA_OC_CODE`
- `CHILECOMPRA_ORGANISM_CODE`
- `CL_RUT`

Relaciones:

- `public_body -> issued -> tender`
- `public_body -> issued -> purchase_order`
- `tender -> awarded_to -> company`
- `purchase_order -> awarded_to -> company`
- `public_body -> purchased_from -> company`
- `purchase_order -> related_to -> tender`

## Idempotencia

El upsert busca primero por identificador estable, luego por `external_id`, y al final por `canonical_name + entity_type + country_code`. Las relaciones usan source idempotente por codigo/tipo para que repetir una ingesta no cree relaciones nuevas si el grafo ya existe.

## Que no corrige automaticamente

`--fix-safe` no fusiona entidades distintas con mismo nombre, entidades con RUT conflictivo, relaciones similares ni cualquier caso donde se pueda perder informacion.

## CSV selectivo

Para cargar CSV rapido sin importar todo:

```bash
cargo run -- fast-demo --sources infolobby,offshore --limit-audiences 80 --offshore-limit 1000 --drop-oldest-percent 70
```

Esto conserva una muestra conectada, descarta parte antigua de InfoLobby y limita relaciones Offshore.
