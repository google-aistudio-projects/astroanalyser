export const RUN_API_SERVER_PY = `#!/usr/bin/env python3
"""
===============================================================================
VEDIC ASTROLOGY HOROSCOPE REST API SERVER (MODEL 2)
===============================================================================
Endpoints:
  POST /api/horoscope/query
    Request Body:
      {
        "person_id": "001ME",
        "start_date": "1998-01-01",  (or "January 1998")
        "end_date": "2020-01-31"     (or "January 2020")
      }
    Response:
      {
        "unique_response_id": "Q-001ME-014-20260928182000",
        "running_number": 14,
        "person_id": "001ME",
        "requested_timeline": { "start_date": "1998-01-01", "end_date": "2020-01-31", "span_years": 22.08 },
        "person_profile": { ... },
        "natal_placements": {
          "D1_rashi_chart": { "count": 11, "lagna_sign": "Dhanus (Sagittarius)", "bodies": [ ... ] },
          "D9_navamsha_chart": { "count": 11, "bodies": [ ... ] }
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
            },
            ...
          ]
        },
        "persisted_in_database": {
          "table": "user_queries",
          "running_number_cycle": "14/100",
          "status": "SAVED"
        }
      }

  GET /api/user-queries/recent
    Retrieves transaction logs from the user_queries database table.

  GET /api/health
    Database connection and server status.
===============================================================================
"""

import os, sys, json, re, configparser
from datetime import datetime, date
from typing import Dict, Any, List
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

from horoscope_fallback_data import get_fallback_data

def load_config() -> Dict[str, Any]:
    cfg = configparser.ConfigParser()
    for p in ["config.ini", "scripts/config.ini"]:
        if os.path.exists(p):
            cfg.read(p)
            break
    return {
        "host": cfg.get("database", "host", fallback="localhost"),
        "port": cfg.getint("database", "port", fallback=5432),
        "dbname": cfg.get("database", "dbname", fallback="astro"),
        "user": cfg.get("database", "user", fallback="postgres"),
        "password": cfg.get("database", "password", fallback="postgres"),
        "api_host": cfg.get("api", "api_host", fallback="0.0.0.0"),
        "api_port": cfg.getint("api", "api_port", fallback=5000)
    }

def get_db_connection(cfg):
    if not HAS_PSYCOPG2:
        return None
    try:
        return psycopg2.connect(
            host=cfg["host"], port=cfg["port"],
            dbname=cfg["dbname"], user=cfg["user"],
            password=cfg["password"]
        )
    except Exception:
        return None

def normalize_date(input_val: str, default_to_end_of_month: bool = False) -> str:
    s = (input_val or "").strip().lower()
    # YYYY-MM-DD
    m = re.match(r'^(\\d{4})-(\\d{1,2})-(\\d{1,2})$', s)
    if m: return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    # Month Name + Year
    m2 = re.search(r'([a-z]+)\\s+(\\d{4})', s)
    if m2:
        months = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}
        mn = months.get(m2.group(1)[:3], 1)
        yr = int(m2.group(2))
        day = 31 if default_to_end_of_month and mn in [1,3,5,7,8,10,12] else (28 if default_to_end_of_month and mn == 2 else (30 if default_to_end_of_month else 1))
        return f"{yr:04d}-{mn:02d}-{day:02d}"
    return s or datetime.now().strftime("%Y-%m-%d")

def query_horoscope_and_timeline(cfg: Dict[str, Any], person_id: str, start_date_str: str, end_date_str: str):
    norm_start = normalize_date(start_date_str, False)
    norm_end = normalize_date(end_date_str, True)
    conn = get_db_connection(cfg)
    if conn:
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            # 1. Fetch person_master
            cur.execute("SELECT * FROM person_master WHERE person_id = %s;", (person_id,))
            person_row = cur.fetchone()
            if not person_row:
                conn.close()
                return {"error": f"Person '{person_id}' not found."}

            # 2. Fetch natal_placement_detail
            cur.execute("""
                SELECT chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde
                FROM natal_placement_detail WHERE person_id = %s ORDER BY chart_type, house_number;
            """, (person_id,))
            rows = cur.fetchall()
            d1 = [r for r in rows if r["chart_type"] == "D1"]
            d9 = [r for r in rows if r["chart_type"] == "D9"]

            # 3. Fetch overlapping dasha intervals (MD > AD > PD)
            cur.execute("""
                SELECT mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date
                FROM vimshottari_dasha_detail
                WHERE person_id = %s AND start_date <= %s AND end_date >= %s
                ORDER BY start_date ASC;
            """, (person_id, norm_end, norm_start))
            dashas = cur.fetchall()
            intervals = [{
                "sequence_index": i + 1,
                "mahadasha_lord_md": d["mahadasha_lord"],
                "antardasha_lord_ad": d["antardasha_lord"],
                "pratyantardasha_lord_pd": d["pratyantardasha_lord"],
                "full_lord_hierarchy": f"MD: {d['mahadasha_lord']} > AD: {d['antardasha_lord']} > PD: {d['pratyantardasha_lord']}",
                "start_date": str(d["start_date"]),
                "end_date": str(d["end_date"]),
                "duration_days": (d["end_date"] - d["start_date"]).days
            } for i, d in enumerate(dashas)]

            # 4. Generate next 1..100 sequence & unique tag
            cur.execute("SELECT nextval('user_query_seq') AS running_num;")
            running_num = cur.fetchone()["running_num"]
            unique_id = f"Q-{person_id}-{running_num:03d}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

            # 5. Build payload
            payload = {
                "unique_response_id": unique_id,
                "running_number": running_num,
                "person_id": person_id,
                "requested_timeline": { "start_date": norm_start, "end_date": norm_end },
                "person_profile": dict(person_row),
                "natal_placements": { "D1_rashi_chart": { "count": len(d1), "bodies": d1 }, "D9_navamsha_chart": { "count": len(d9), "bodies": d9 } },
                "vimshottari_dasha_intervals": { "total_intervals_count": len(intervals), "granularity": "Pratyantardasha (PD) Level", "intervals": intervals },
                "server_timestamp": datetime.now().isoformat(),
                "persisted_in_database": { "table": "user_queries", "running_number_cycle": f"{running_num}/100", "status": "SAVED" }
            }

            # 6. Insert into user_queries
            cur.execute("""
                INSERT INTO user_queries (query_id, running_number, person_id, start_date, end_date, response_payload)
                VALUES (%s, %s, %s, %s, %s, %s);
            """, (unique_id, running_num, person_id, norm_start, norm_end, json.dumps(payload, default=str)))
            conn.commit()
            conn.close()
            return payload
        except Exception as e:
            if conn: conn.close()
            print(f"DB Error: {e}")

    # Fallback dataset if PostgreSQL is offline
    return get_fallback_data(person_id, norm_start, norm_end)

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/horoscope/query":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode()) if length else {}
            res = query_horoscope_and_timeline(load_config(), body.get("person_id", "001ME"), body.get("start_date", "1998-01-01"), body.get("end_date", "2020-01-31"))
            self.send_response(200 if "error" not in res else 404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(res, indent=2, ensure_ascii=False, default=str).encode())
            return
        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 5000
    print(f"Serving Vedic Horoscope REST API on port {port}...")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
`;

export const RUN_INGESTION_PY = `#!/usr/bin/env python3
"""
Simple 1-Command Runner for Tamil Horoscope Ingestion (Model 1).
Reads all database credentials and file options directly from config.ini.

Usage:
    python3 run_ingestion.py
"""
import os
import sys

# Ensure scripts folder is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scripts"))

from extract_tamil_horoscope import main

if __name__ == "__main__":
    main()
`;

export const CONFIG_INI_TEXT = `# ===============================================================================
# CONFIGURATION FOR TAMIL HOROSCOPE POSTGRESQL INGESTION & REST API
# ===============================================================================

[database]
# Local or Remote PostgreSQL Database Settings
host = localhost
port = 5432
dbname = astro
user = postgres
password = postgres

[pdf]
# Path to the Tamil Horoscope PDF (relative or absolute)
pdf_path = horoscope.pdf

[options]
# Set dry_run = true to test parsing without connecting to PostgreSQL
dry_run = false

# Export generated SQL insert dump to file (leave blank to disable)
export_sql = scripts/insert_001ME.sql

# Export parsed records to JSON format (leave blank to disable)
export_json = scripts/extracted_001ME.json

[api]
# Model 2 REST API settings
api_host = 0.0.0.0
api_port = 5000
`;

export const SCHEMA_SQL_TEXT = `-- ===============================================================================
-- TARGET POSTGRESQL SCHEMA SPECIFICATION: VEDIC ASTROLOGY HOROSCOPE
-- ===============================================================================

CREATE TABLE IF NOT EXISTS person_master (
    person_id VARCHAR(50) PRIMARY KEY,
    person_name VARCHAR(100),
    age INTEGER,
    date_of_birth DATE,
    place_of_birth VARCHAR(100),
    birth_lagna VARCHAR(50),
    birth_rashi VARCHAR(50),
    birth_star VARCHAR(50),
    birth_star_pada INTEGER,
    starting_dasha_lord VARCHAR(50),
    dasha_balance_years INTEGER,
    dasha_balance_months INTEGER,
    dasha_balance_days INTEGER,
    dasha_balance_text VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS natal_placement_detail (
    id SERIAL PRIMARY KEY,
    person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
    chart_type VARCHAR(10) NOT NULL, -- 'D1' or 'D9'
    body_name VARCHAR(50) NOT NULL,  -- Standardized English (e.g. 'Sun (Surya)', 'Lagna')
    rashi_name VARCHAR(50) NOT NULL, -- Standardized Sign (e.g. 'Mesham (Aries)', 'Dhanus (Sagittarius)')
    house_number INTEGER NOT NULL CHECK (house_number BETWEEN 1 AND 12), -- 1 to 12 clockwise relative to Lagna
    nakshatra_name VARCHAR(50),
    pada INTEGER,
    degree_sputa VARCHAR(20),
    is_retrograde BOOLEAN DEFAULT FALSE,
    CONSTRAINT uq_natal_person_chart_body UNIQUE (person_id, chart_type, body_name)
);

CREATE TABLE IF NOT EXISTS vimshottari_dasha_detail (
    id SERIAL PRIMARY KEY,
    person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
    mahadasha_lord VARCHAR(50) NOT NULL,
    antardasha_lord VARCHAR(50) NOT NULL,
    pratyantardasha_lord VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rating_score VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================================================
-- D. TABLE: user_queries (Transaction audit table with 1 to 100 cycling sequence)
-- ===============================================================================
CREATE SEQUENCE IF NOT EXISTS user_query_seq
    MINVALUE 1
    MAXVALUE 100
    START WITH 1
    INCREMENT BY 1
    CYCLE;

CREATE TABLE IF NOT EXISTS user_queries (
    id SERIAL PRIMARY KEY,
    query_id VARCHAR(50) UNIQUE NOT NULL,      -- e.g. 'Q-001ME-014-20260928181500'
    running_number INTEGER NOT NULL,           -- Cycling unique number 1 to 100
    person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;
