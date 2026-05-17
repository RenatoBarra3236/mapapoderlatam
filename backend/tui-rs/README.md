# Mapa Poder Latam Data CLI

Este binario funciona como CLI normal. El modo visual anterior queda como legado; para hackathon usar estos comandos desde `backend/tui-rs`.

## Variables

```bash
export CHILECOMPRA_TICKET="..."
export RUST_DATABASE_URL="postgresql://usuario:password@localhost:5432/db"
```

Tambien acepta `DATABASE_URL`. Si viene como `postgresql+psycopg://...`, la CLI lo convierte a `postgresql://...`. No hardcodear ni commitear tickets. La CLI nunca imprime el ticket; las URLs de logs/cache usan `ticket=***`.

`CHILECOMPRA_BASE_URL` es opcional y permite apuntar a otro host compatible.

## ChileCompra Selective Loader

```bash
cargo run -- ingest-chilecompra --fast-demo --limit 50
cargo run -- ingest-chilecompra --fast-demo --dry-run
cargo run -- ingest-chilecompra --keyword "emergencia" --from 2025-01-01 --to 2025-01-31 --limit 50
cargo run -- ingest-chilecompra --buyer "Municipalidad" --from 2025-01-01 --to 2025-01-31 --limit 50
cargo run -- ingest-chilecompra --supplier-rut "76123456-7" --limit 50
```

Defaults conservadores: `--max-requests 20`, `--delay-ms 1000`, `--retry 2`, `--backoff-ms 2000`, `--limit 50`, cache activado.

Rate limiting: antes de cada request real espera `delay-ms`, nunca supera `max-requests`, reintenta 429/5xx con backoff limitado y aborta 401/403 con mensaje claro.

Cache local: `.cache/chilecompra`. Cada archivo JSON guarda `request_url`, `params`, `fetched_at`, `status_code`, `payload_hash` y `payload`. Usa `--no-cache` para desactivar.

La ingesta primero lista pocos registros por fecha y luego descarga detalle solo de los seleccionados. En `fast-demo` prioriza registros con comprador, proveedor, monto, fecha y codigo.

## Hackathon Load

Orquestador recomendado para demo. Usa cargas pequenas, idempotentes y evita raw records pesados por defecto.

```bash
cargo run --release -- hackathon-load --profile smoke --dry-run
cargo run --release -- hackathon-load --profile smoke
cargo run --release -- hackathon-load --profile demo
```

Perfiles:

- `smoke`: valida rapido la tuberia completa.
- `demo`: dataset chico pero presentable.
- `rich`: mas volumen si queda tiempo.

Flags utiles:

```bash
cargo run --release -- hackathon-load --profile demo --focus "municipalidad"
cargo run --release -- hackathon-load --profile demo --skip-chile
cargo run --release -- hackathon-load --profile demo --infolobby-limit 200 --offshore-limit 500 --chile-limit 30
```

Offshore en modo limitado escanea CSVs y solo copia a PostgreSQL las relaciones/nodos seleccionados por pais y limite. Por defecto el orquestador usa `--offshore-country-code CHL`.

## CSV Rapido Selectivo

```bash
cargo run -- fast-demo --sources infolobby,offshore --limit-audiences 80 --offshore-limit 1000 --drop-oldest-percent 70
```

InfoLobby selecciona audiencias conectadas y, con `--drop-oldest-percent`, descarta una proporcion de las mas antiguas antes de copiar filas relacionadas. Offshore limita relaciones con `--offshore-limit`.

## Duplicados

```bash
cargo run -- db-diagnose-duplicates
cargo run -- db-diagnose-duplicates --fix-safe
```

`--fix-safe` solo borra duplicados exactos de `entity_identifiers` que apuntan al mismo `entity_id`, relaciones identicas y raw records identicos. No fusiona entidades con mismo nombre, RUT conflictivo ni relaciones similares.

## Verificacion Backend

```bash
curl "http://localhost:3001/api/search?q=municipalidad"
curl "http://localhost:3001/api/search?q=chilecompra"
curl "http://localhost:3001/api/search?q=licitaci%C3%B3n"
curl "http://localhost:3001/api/graph/{entity_id}?depth=2"
```
