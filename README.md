# Tamil Horoscope (Jadhagam) Ingestion & REST API Engine 🕉️

A dual-model Vedic astrology data engineering pipeline and REST API server designed to:
1. **Model 1 (`run_ingestion.py`)**: Extract structured data from **Tamil Horoscope PDFs (ஜாதகம் / Jadhagam)** and load them directly into a normalized **PostgreSQL** schema.
2. **Model 2 (`run_api_server.py`)**: Serve a high-performance REST API that takes a `person_id` and date timeline (e.g., `January 1998` to `January 2020`), returns D1 & D9 chart placements with full Pratyantardasha (MD > AD > PD) timeline intervals, generates a cycling 1..100 running number, and persists every query transaction into the `user_queries` table.

---

## 🏗️ Architecture: Two Operational Models

| Model | Component Script | Execution | Primary Function |
| :--- | :--- | :--- | :--- |
| **Model 1** | `run_ingestion.py` | `python run_ingestion.py` | Parses `horoscope.pdf`, extracts birth metadata, D1/D9 grids, and 40 pages of Vimshottari dasha, then loads into PostgreSQL (`person_master`, `natal_placement_detail`, `vimshottari_dasha_detail`). |
| **Model 2** | `run_api_server.py` | `python run_api_server.py` | Starts REST API server on port 5000. Provides `POST /api/horoscope/query`, fetches placements + all PD-level intervals for requested range, cycles sequence 1..100, and logs into `user_queries`. |

---

## 📋 Features

- **Automated PDF Parsing (Model 1)**: Analyzes 54-page Tamil horoscope PDFs, extracting personal birth details, planetary positions, D1 (Rashi) and D9 (Navamsha) charts, and 40 pages of Vimshottari Dasha intervals.
- **Dual Tamil Font Encoding Engine**: Transparently handles both modern **UTF-8 Unicode Tamil** and legacy **8-bit Bamini/Vanavil ASCII glyphs** (such as `#hp` for சூரியன், `rdp` for சனி, and `jDR` for தனுசு).
- **South Indian 4×4 Grid Translation**: Dynamically maps 12 zodiac signs and calculates sequential house numbers (**House 1 to 12 clockwise**) relative to the native's Lagna.
- **Timeline Dasha Extractor (Model 2)**: For any given date window, extracts each and every sub-period down to **Pratyantardasha (PD / Anthara)** level with exact duration in days and lord hierarchies.
- **1..100 Cycling Unique Sequence**: Uses a dedicated cycling PostgreSQL sequence (`user_query_seq`) to assign a unique running number 1 to 100 for every query, alongside a timestamped unique tag (e.g., `Q-001ME-014-20260928182000`).
- **Transaction Audit Logging**: Automatically records every generated JSON response, requested date range, and sequence number into the `user_queries` table.
- **Config-Driven Execution**: Control database credentials, PDF paths, and API host/port in `config.ini`.

---

## 🗄️ PostgreSQL Database Schema (4 Tables)

### 1. `person_master` (Primary Entity)
Stores birth coordinates, Lagna, Rashi, Star, and initial starting Dasha balance.
- `person_id VARCHAR(50) PRIMARY KEY`
- `person_name VARCHAR(100)`, `age INTEGER`, `date_of_birth DATE`, `place_of_birth VARCHAR(100)`
- `birth_lagna VARCHAR(50)`, `birth_rashi VARCHAR(50)`, `birth_star VARCHAR(50)`, `birth_star_pada INTEGER`
- `starting_dasha_lord VARCHAR(50)`, `dasha_balance_years INTEGER`, `dasha_balance_months INTEGER`, `dasha_balance_days INTEGER`
- `dasha_balance_text VARCHAR(150)`

### 2. `natal_placement_detail` (Planetary Coordinates)
Planetary positions in **D1 (Rashi)** and **D9 (Navamsha)** charts with calculated house numbers relative to Lagna (**Lagna = House 1**).
- `person_id VARCHAR(50) REFERENCES person_master(person_id)`
- `chart_type VARCHAR(10)` (`'D1'` or `'D9'`)
- `body_name VARCHAR(50)` (e.g. `'Sun (Surya)'`, `'Lagna'`)
- `rashi_name VARCHAR(50)` (e.g. `'Dhanus (Sagittarius)'`)
- `house_number INTEGER` (1 to 12 clockwise relative to Lagna)
- `nakshatra_name VARCHAR(50)`, `pada INTEGER`, `degree_sputa VARCHAR(20)`, `is_retrograde BOOLEAN`
- `CONSTRAINT uq_natal_person_chart_body UNIQUE (person_id, chart_type, body_name)`

### 3. `vimshottari_dasha_detail` (Timeline Intervals)
Continuous chronological timeline of Mahadasha, Antardasha (Bukthi), and Pratyantardasha (Anthara) periods from 1976 to 2090.
- `person_id VARCHAR(50) REFERENCES person_master(person_id)`
- `mahadasha_lord VARCHAR(50)`, `antardasha_lord VARCHAR(50)`, `pratyantardasha_lord VARCHAR(50)`
- `start_date DATE`, `end_date DATE`

### 4. `user_queries` (REST API Transaction Audit Table)
Audit log automatically created and populated by Model 2 REST API.
- `id SERIAL PRIMARY KEY`
- `query_id VARCHAR(50) UNIQUE` (e.g. `Q-001ME-014-20260928182000`)
- `running_number INTEGER` (Cycling 1 to 100 sequence)
- `person_id VARCHAR(50) REFERENCES person_master(person_id)`
- `start_date DATE`, `end_date DATE`
- `response_payload JSONB` (The full generated JSON response)
- `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`

---

## 🚀 How to Run

### Step 1: Install Dependencies
```bash
pip install psycopg2-binary pdfplumber requests
```

### Step 2: Configure `config.ini`
```ini
[database]
host = localhost
port = 5432
dbname = astro
user = postgres
password = postgres

[pdf]
pdf_path = horoscope.pdf

[options]
dry_run = false
export_sql = scripts/insert_001ME.sql
export_json = scripts/extracted_001ME.json

[api]
api_host = 0.0.0.0
api_port = 5000
```

---

### Step 3: Run Model 1 — PDF Ingestion Engine
```bash
python run_ingestion.py
```
This parses the PDF and ingests:
- 1 row in `person_master`
- 22 rows in `natal_placement_detail` (11 in D1 + 11 in D9)
- 720 rows in `vimshottari_dasha_detail`

---

### Step 4: Run Model 2 — Horoscope REST API Server
```bash
python run_api_server.py
```
The REST API server will start on `http://localhost:5000`.

#### Testing with cURL:
```bash
curl -X POST http://localhost:5000/api/horoscope/query \
  -H "Content-Type: application/json" \
  -d '{
    "person_id": "001ME",
    "start_date": "January 1998",
    "end_date": "January 2020"
  }'
```

#### Testing with Python:
```python
import requests

res = requests.post("http://localhost:5000/api/horoscope/query", json={
    "person_id": "001ME",
    "start_date": "January 1998",
    "end_date": "January 2020"
})
data = res.json()

print(f"Unique Tag:    {data['unique_response_id']}")
print(f"Running Num:   {data['running_number']} (Cycle 1..100)")
print(f"Total PDs:     {data['vimshottari_dasha_intervals']['total_intervals_count']} intervals")
print(f"Stored in DB:  {data['persisted_in_database']['table']}")
```

---

## 📦 Standardized JSON Response Structure

```json
{
  "unique_response_id": "Q-001ME-014-20260928182000",
  "running_number": 14,
  "person_id": "001ME",
  "requested_timeline": {
    "start_date": "1998-01-01",
    "end_date": "2020-01-31",
    "span_years": 22.08
  },
  "person_profile": {
    "person_id": "001ME",
    "person_name": "ME",
    "age": 50,
    "date_of_birth": "1976-01-26",
    "birth_lagna": "Dhanus (Sagittarius)",
    "birth_rashi": "Vrischigam (Scorpio)",
    "birth_star": "Anusham (Anuradha)",
    "birth_star_pada": 2,
    "starting_dasha_lord": "Saturn (Sani)",
    "dasha_balance_text": "13-வருஷம் 2-மாதம் 5-நாள் 31-நாழி 47-விநாடி"
  },
  "natal_placements": {
    "D1_rashi_chart": {
      "count": 11,
      "lagna_sign": "Dhanus (Sagittarius)",
      "bodies": [
        {
          "body_name": "Lagna",
          "rashi_name": "Dhanus (Sagittarius)",
          "house_number": 1,
          "nakshatra_name": "Purva Ashadha",
          "pada": 1,
          "degree_sputa": "16° 33'",
          "is_retrograde": false
        },
        {
          "body_name": "Sun (Surya)",
          "rashi_name": "Makaram (Capricorn)",
          "house_number": 2,
          "nakshatra_name": "Shravana",
          "pada": 1,
          "degree_sputa": "11° 37'",
          "is_retrograde": false
        }
      ]
    },
    "D9_navamsha_chart": {
      "count": 11,
      "bodies": [
        {
          "body_name": "Lagna",
          "rashi_name": "Simham (Leo)",
          "house_number": 1,
          "is_retrograde": false
        }
      ]
    }
  },
  "vimshottari_dasha_intervals": {
    "total_intervals_count": 103,
    "granularity": "Pratyantardasha (PD) Level",
    "intervals": [
      {
        "sequence_index": 1,
        "mahadasha_lord_md": "Mercury (Budha)",
        "antardasha_lord_ad": "Mars (Sevvai)",
        "pratyantardasha_lord_pd": "Jupiter (Guru)",
        "full_lord_hierarchy": "MD: Mercury (Budha) > AD: Mars (Sevvai) > PD: Jupiter (Guru)",
        "start_date": "1997-12-16",
        "end_date": "1998-02-04",
        "duration_days": 50
      }
    ]
  },
  "server_timestamp": "2026-09-28T18:20:00.123456",
  "persisted_in_database": {
    "table": "user_queries",
    "running_number_cycle": "14/100",
    "status": "SAVED"
  }
}
```

---

## 🔍 Verification Queries

Verify transaction queries in PostgreSQL:
```sql
-- View all recorded user queries
SELECT query_id, running_number, person_id, start_date, end_date, created_at
FROM user_queries
ORDER BY id DESC;

-- Inspect response JSON payload
SELECT query_id, running_number, response_payload->'vimshottari_dasha_intervals'->>'total_intervals_count' AS total_pds
FROM user_queries;
```

---

## 📁 Repository Structure

```text
├── config.ini                    # Central configuration file (DB credentials & options)
├── run_ingestion.py              # Single-command execution runner (Model 1)
├── run_api_server.py             # REST API server (Model 2) on port 5000
├── horoscope_fallback_data.py    # Fallback dataset when PostgreSQL is offline
├── README.md                     # Documentation & setup guide
├── scripts/
│   ├── config.ini                # Secondary config backup
│   ├── extract_tamil_horoscope.py# Core extraction & PostgreSQL ingestion engine
│   ├── schema.sql                # PostgreSQL DDL with user_queries table & user_query_seq
│   ├── extracted_001ME.sql       # Pre-generated complete SQL insert dump for 001ME
│   ├── extracted_001ME.json      # Structured JSON export of all extracted data
│   └── requirements.txt          # Python dependency list
└── src/                          # Interactive visualizer & REST API workbench
```

---

## 📄 License
Vedic astrology calculation, database ingestion, and REST API engine developed for Tamil Jadhagam processing. Open source under the MIT License.

