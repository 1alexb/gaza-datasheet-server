## External Event Contract

The `/api/external/events` endpoint provides a normalized, source agnostic
stream of events suitable for Timemap ingestion and comparative analysis.

### Event Schema

Each event must conform to the following structure:

{
  "date": "YYYY-MM-DD | null",
  "location": "string | null",
  "latitude": "number | null",
  "longitude": "number | null",
  "source": "string | null"
}

### Contract Guarantees

- The schema above is stable and version independent
- Fields may be null when not provided by the source
- No source specific fields are exposed at this level
- New data sources must always adapt to this contract

ACLED integration is present in code but currently disabled at runtime due to
upstream authentication and availability issues. This is handled gracefully and
does not affect system stability.

## API Endpoints

### External Source Endpoints
- `/api/external/techforpalestine`
- `/api/external/techforpalestine-daily`
- `/api/external/reliefweb`
- `/api/external/acled` (degraded)

### Aggregated Endpoint
- `/api/external/events`  
  Returns **only Timemap-aligned events** from all healthy sources.

### Health Check
- `/api/external/health`

## Error Handling and Resilience

External API failures are isolated per source. A failure in one upstream API
(see ACLED) does not impact the availability of other sources or the aggregated
event endpoint.

## Configuration and Security

All sesnsitive data is stored in environment variables and memory, and also
excluded from version control via `.gitignore`. (.env file)
ireeerrersed
The repository is private and access is restricted to Yansantha.

## Configuration and Security

All API credentials and service keys are stored in environment variables and
excluded from version control via `.gitignore`.

## Planned Next Steps

- Parameterized filtering for `/external/events` (date range, source)
- Median and cross-source comparison logic
- UI-driven query controls
- Re-enable ACLED once upstream authentication stabilizes (562 invalid SSL as in today)

## Data Persistence and Database Design

This project uses Datasheet Server backed by Google Sheets for the data storing instead of SQL. 
This design choice is deliberate and aligns with the Timemap standard configuration.

Each Google Sheet tab functions as a database table:
- Rows represent records
- Columns represent fixed schema fields
- Updates are deterministic

External data is ingested, normalized, and persisted via the `/update`
endpoint before being served to Timemap.

## Future Work

Planned extensions include parameterized filtering of external events
by date range, source, and location. The canonical event contract
supports this without requiring schema changes.

### External Data Integration (Milestones 5–7)

As of 20 December, the project has achieved a stable external data integration

**Integrated data sources**
- TechForPalestine — summary casualty data
- TechForPalestine — daily casualty time series (v2 API)
- ReliefWeb — humanitarian reports
- ACLED — integration stub present (upstream API instability documented)

**Key technical achievements**
- Introduced a frozen external events contract (`/api/external/events`)
- Normalized all sources into a Timemap compatible event schema:
  - date
  - location
  - latitude
  - longitude
  - source
- Implemented deterministic aggregation, sorting, and filtering:
  - source filtering
  - date range filtering
- Added derived analytics endpoint over external events:
  - totals per source
  - date range coverage
  - undated event tracking
- Added health/status endpoint to demonstrate resilience to partial upstream failure
- Tested thoroughly each of the API endpoints for satisfactory outputs

Successful update timemap_data
===========================================
Server running on port 4040
Fetched 804 daily casualty records.
Fetched 10 ReliefWeb reports.
GET /api/external/analytics/events 304 511.123 ms - -
Fetched 804 daily casualty records.
Fetched 10 ReliefWeb reports.
GET /api/external/analytics/events 200 331.800 ms - 176
GET /favicon.ico 404 2.766 ms - 150

GET /api/external/events 200 508.038 ms - 86990
GET /favicon.ico 404 1.161 ms - 150
Fetched 804 daily casualty records.
Fetched 10 ReliefWeb reports.
GET /api/external/events?source=ReliefWeb 200 325.367 ms - 861
Fetched 804 daily casualty records.
Fetched 10 ReliefWeb reports.
GET /api/external/events?from=2023-10-10&to=2023-10-20 200 318.623 ms - 1178
Fetched 804 daily casualty records.
Fetched 10 ReliefWeb reports.
GET /api/external/events?source=TechForPalestine-Daily&from=2023-10-07 200 326.363 ms - 86029

**Design decisions**
- External data normalization is strictly separated from persistence
- Source specific fields are intentionally excluded from the frozen contract
- Google Sheets (via Timemap/Datasheet Server) are used as the project database, not SQL, as timemap and datasheet server work specifically with data sheets

**Current state**
- External data is fully fetchable, normalized, filterable, and analyzable
- Persistence into Timemap sheets is planned as the next step