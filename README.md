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
