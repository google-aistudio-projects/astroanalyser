# Tamil Horoscope (Jadhagam) PostgreSQL Ingestion Engine 🕉️

A Python data engineering pipeline and database ingestion system designed to extract structured Vedic astrology data from **Tamil Horoscope PDFs (ஜாதகம் / Jadhagam)** and load them directly into a normalized **PostgreSQL** schema.

---

## 📋 Features

- **Automated PDF Parsing**: Analyzes 54-page Tamil horoscope PDFs, extracting personal birth details, planetary positions, D1 (Rashi) and D9 (Navamsha) charts, and 40 pages of Vimshottari Dasha intervals.
- **Dual Tamil Font Encoding Engine**: Transparently handles both modern **UTF-8 Unicode Tamil** and legacy **8-bit Bamini/Vanavil ASCII glyphs** (such as `#hp` for சூரியன், `rdp` for சனி, and `jDR` for தனுசு).
- **South Indian 4×4 Grid Translation**: Dynamically maps 12 zodiac signs and calculates sequential house numbers (**House 1 to 12 clockwise**) relative to the native's Lagna.
- **Config-Driven Execution**: Control all database host credentials, PDF file paths, and output settings via `config.ini` — run everything with a single command without CLI flags.
- **Safe Batch Ingestion**: Built with `psycopg2` and transactional SQL statements with `ON CONFLICT` upserts and indexed lookups.
- **Multi-Format Export**: Generates raw `.sql` insert scripts and clean `.json` representations for pgAdmin, psql, or downstream analytics.

---

## 🗄️ Target PostgreSQL Schema

The script automatically provisions and populates the following 3 tables:

### 1. `person_master`
Primary entity storing personal birth coordinates, Lagna, Rashi, Star, and initial starting Dasha balance.

| Column | Type | Description | Sample Extracted Value |
| :--- | :--- | :--- | :--- |
| `person_id` | `VARCHAR(50)` | Primary Key (Horoscope Reg No) | `001ME` |
| `person_name` | `VARCHAR(100)` | Name / Identifier | `ME` |
| `age` | `INTEGER` | Calculated native age | `50` |
| `date_of_birth` | `DATE` | Date of Birth (from Dasha anchor) | `1976-01-26` |
| `place_of_birth` | `VARCHAR(100)` | Place of Birth | `Tamil Nadu, India` |
| `birth_lagna` | `VARCHAR(50)` | Ascendant Sign | `Dhanus (Sagittarius)` |
| `birth_rashi` | `VARCHAR(50)` | Moon Sign (ஜனன இராசி) | `Vrischigam (Scorpio)` |
| `birth_star` | `VARCHAR(50)` | Birth Nakshatra | `Anusham (Anuradha)` |
| `birth_star_pada` | `INTEGER` | Nakshatra Quarter (பாதம்) | `2` |
| `starting_dasha_lord` | `VARCHAR(50)` | Dasha Lord at Birth | `Saturn (Sani)` |
| `dasha_balance_years` | `INTEGER` | Balance years remaining at birth | `13` |
| `dasha_balance_months`| `INTEGER` | Balance months remaining at birth| `2` |
| `dasha_balance_days` | `INTEGER` | Balance days remaining at birth | `5` |
| `dasha_balance_text` | `VARCHAR(150)` | Full Tamil balance text | `13-வருஷம் 2-மாதம் 5-நாள் 31-நாழி 47-விநாடி` |

### 2. `natal_placement_detail`
Planetary positions in both **D1 (Rashi)** and **D9 (Navamsha)** charts with calculated house numbers relative to Lagna.

| Column | Type | Description |
| :--- | :--- | :--- |
| `person_id` | `VARCHAR(50)` | Foreign key referencing `person_master(person_id)` |
| `chart_type` | `VARCHAR(10)` | `'D1'` (Rashi) or `'D9'` (Navamsha) |
| `body_name` | `VARCHAR(50)` | Standardized Name (e.g., `Sun (Surya)`, `Lagna`, `Venus (Sukra)`) |
| `rashi_name` | `VARCHAR(50)` | Standardized Zodiac Sign (e.g., `Dhanus (Sagittarius)`) |
| `house_number` | `INTEGER` | **1 to 12 clockwise relative to Lagna = 1** |
| `nakshatra_name` | `VARCHAR(50)` | Nakshatra occupied (D1 chart) |
| `pada` | `INTEGER` | Quarter 1 to 4 |
| `degree_sputa` | `VARCHAR(20)` | Exact celestial coordinates (e.g., `16° 33'`) |
| `is_retrograde` | `BOOLEAN` | `TRUE` if marked with `(வ)` / `(t)` |

### 3. `vimshottari_dasha_detail`
Continuous chronological timeline of Mahadasha, Antardasha (Bukthi), and Pratyantardasha periods.

| Column | Type | Description |
| :--- | :--- | :--- |
| `person_id` | `VARCHAR(50)` | Foreign key referencing `person_master(person_id)` |
| `mahadasha_lord` | `VARCHAR(50)` | Major period planet (e.g., `Saturn (Sani)`) |
| `antardasha_lord` | `VARCHAR(50)` | Sub-period planet (e.g., `Ketu`) |
| `pratyantardasha_lord` | `VARCHAR(50)` | Sub-sub period planet (e.g., `Venus (Sukra)`) |
| `start_date` | `DATE` | Period commencement date (`YYYY-MM-DD`) |
| `end_date` | `DATE` | Period termination date (`YYYY-MM-DD`) |

---

## 🚀 Quick Start Guide

### Step 1: Clone & Install Dependencies

```bash
# Install required Python libraries
pip install psycopg2-binary pdfplumber
```

### Step 2: Configure Database Credentials in `config.ini`

Open `config.ini` in the project root:

```ini
[database]
host = localhost
port = 5432
dbname = vedic_astro
user = postgres
password = your_postgres_password

[pdf]
# Path to your Tamil horoscope PDF
pdf_path = horoscope.pdf

[options]
# Set to false to write directly to PostgreSQL (or true for dry-run)
dry_run = false

# File paths for SQL and JSON exports
export_sql = scripts/insert_001ME.sql
export_json = scripts/extracted_001ME.json
```

### Step 3: Run the Ingestion (One Command)

Just execute the runner script:

```bash
python3 run_ingestion.py
```

Done! The script will automatically:
1. Parse the PDF layout and metadata.
2. Calculate clockwise house positions with Lagna as House 1.
3. Establish a connection to your local PostgreSQL database.
4. Create the target tables if they do not exist.
5. Ingest the native's profile, chart placements, and Dasha timeline.
6. Export backup SQL and JSON files.

---

## ⚙️ Alternative Ingestion Methods

### Option A: Direct SQL Execution (Without Python)
If you already have PostgreSQL client tools (`psql`, pgAdmin, DBeaver):

```bash
# 1. Create database
createdb -U postgres vedic_astro

# 2. Initialize schema tables
psql -U postgres -d vedic_astro -f scripts/schema.sql

# 3. Insert all records directly
psql -U postgres -d vedic_astro -f scripts/extracted_001ME.sql
```

### Option B: Command-Line Overrides
You can override any parameter in `config.ini` on the fly:

```bash
# Run with a custom PDF file
python3 run_ingestion.py --pdf "/path/to/another_horoscope.pdf"

# Run in dry-run mode (parse and test without writing to DB)
python3 run_ingestion.py --dry-run
```

---

## 🔍 Verification Queries

Once ingested, run these SQL queries to verify your data:

```sql
-- 1. Check Native's Profile & Dasha Balance
SELECT person_id, date_of_birth, birth_lagna, birth_rashi, birth_star, dasha_balance_text
FROM person_master;

-- 2. View D1 Rashi Chart sorted by House Number (1 to 12 from Lagna)
SELECT house_number, body_name, rashi_name, nakshatra_name, pada, degree_sputa, is_retrograde
FROM natal_placement_detail
WHERE person_id = '001ME' AND chart_type = 'D1'
ORDER BY house_number;

-- 3. Find the Current Active Dasha Period
SELECT mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date
FROM vimshottari_dasha_detail
WHERE person_id = '001ME'
  AND CURRENT_DATE BETWEEN start_date AND end_date;
```

---

## 📁 Repository Structure

```text
├── config.ini                    # Central configuration file (DB credentials & options)
├── run_ingestion.py              # Single-command execution runner
├── README.md                     # Documentation & setup guide
├── scripts/
│   ├── config.ini                # Secondary config backup
│   ├── extract_tamil_horoscope.py# Core extraction & PostgreSQL ingestion engine
│   ├── schema.sql                # PostgreSQL DDL table definitions & indexes
│   ├── extracted_001ME.sql       # Pre-generated complete SQL insert dump for 001ME
│   ├── extracted_001ME.json      # Structured JSON export of all extracted data
│   └── requirements.txt          # Python dependency list
└── src/                          # Interactive visualizer & verification applet
```

---

## 📄 License
Vedic astrology calculation and database ingestion engine developed for Tamil Jadhagam processing. Open source under the MIT License.
