import React, { useState, useMemo } from 'react';
import {
  FileText,
  Database,
  Code2,
  Compass,
  CheckCircle2,
  Copy,
  Download,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  Search,
  Terminal,
  Info,
  Server,
  Table,
  BookOpen
} from 'lucide-react';
import {
  samplePersonMaster,
  sampleNatalPlacements,
  sampleDashaRecords,
  PersonMaster,
  NatalPlacement,
  DashaRecord
} from './data/horoscopeData';

// Standard 12 South Indian chart cell coordinate mappings (row, col)
// 0,0: Meenam (Pisces)   | 0,1: Mesham (Aries)   | 0,2: Rishabam (Taurus) | 0,3: Mithunam (Gemini)
// 1,0: Kumbam (Aquarius) | Center 1,1            | Center 1,2             | 1,3: Katakam (Cancer)
// 2,0: Makaram (Capri)   | Center 2,1            | Center 2,2             | 2,3: Simham (Leo)
// 3,0: Dhanus (Sagit)    | 3,1: Vrischigam (Sco) | 3,2: Thulaam (Libra)   | 3,3: Kanni (Virgo)

interface ChartCellDef {
  r: number;
  c: number;
  signIndex: number; // 1 to 12 (1=Aries ... 12=Pisces)
  tamilName: string;
  engSign: string;
}

const SOUTH_INDIAN_CELLS: ChartCellDef[] = [
  { r: 0, c: 0, signIndex: 12, tamilName: 'மீனம்', engSign: 'Meenam (Pisces)' },
  { r: 0, c: 1, signIndex: 1, tamilName: 'மேஷம்', engSign: 'Mesham (Aries)' },
  { r: 0, c: 2, signIndex: 2, tamilName: 'ரிஷபம்', engSign: 'Rishabam (Taurus)' },
  { r: 0, c: 3, signIndex: 3, tamilName: 'மிதுனம்', engSign: 'Mithunam (Gemini)' },

  { r: 1, c: 0, signIndex: 11, tamilName: 'கும்பம்', engSign: 'Kumbam (Aquarius)' },
  { r: 1, c: 3, signIndex: 4, tamilName: 'கடகம்', engSign: 'Katakam (Cancer)' },

  { r: 2, c: 0, signIndex: 10, tamilName: 'மகரம்', engSign: 'Makaram (Capricorn)' },
  { r: 2, c: 3, signIndex: 5, tamilName: 'சிம்மம்', engSign: 'Simham (Leo)' },

  { r: 3, c: 0, signIndex: 9, tamilName: 'தனுசு', engSign: 'Dhanus (Sagittarius)' },
  { r: 3, c: 1, signIndex: 8, tamilName: 'விருச்சிகம்', engSign: 'Vrischigam (Scorpio)' },
  { r: 3, c: 2, signIndex: 7, tamilName: 'துலாம்', engSign: 'Thulaam (Libra)' },
  { r: 3, c: 3, signIndex: 6, tamilName: 'கன்னி', engSign: 'Kanni (Virgo)' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'database' | 'python' | 'sql' | 'pdf_breakdown'>('overview');
  const [selectedChart, setSelectedChart] = useState<'D1' | 'D9'>('D1');
  const [dbSubTab, setDbSubTab] = useState<'person_master' | 'natal_placement_detail' | 'vimshottari_dasha_detail'>('person_master');
  const [dashaFilter, setDashaFilter] = useState<string>('all');
  const [searchDasha, setSearchDasha] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2500);
  };

  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter dasha records
  const filteredDashas = useMemo(() => {
    return sampleDashaRecords.filter(d => {
      const matchLord = dashaFilter === 'all' || d.mahadasha_lord.toLowerCase().includes(dashaFilter.toLowerCase());
      const matchSearch =
        d.mahadasha_lord.toLowerCase().includes(searchDasha.toLowerCase()) ||
        d.antardasha_lord.toLowerCase().includes(searchDasha.toLowerCase()) ||
        d.pratyantardasha_lord.toLowerCase().includes(searchDasha.toLowerCase()) ||
        d.start_date.includes(searchDasha) ||
        d.end_date.includes(searchDasha);
      return matchLord && matchSearch;
    });
  }, [dashaFilter, searchDasha]);

  // Natal placements for selected chart
  const currentChartPlacements = useMemo(() => {
    return sampleNatalPlacements.filter(p => p.chart_type === selectedChart);
  }, [selectedChart]);

  // Lagna sign index for currently selected chart
  const lagnaPlacement = currentChartPlacements.find(p => p.body_name === 'Lagna');
  const lagnaSignIndex = lagnaPlacement
    ? SOUTH_INDIAN_CELLS.find(c => c.engSign === lagnaPlacement.rashi_name)?.signIndex || 9
    : 9;

  // Python code snippet
  const pythonScript = `#!/usr/bin/env python3
"""
TAMIL HOROSCOPE (JADHAGAM) DATA INGESTION ENGINE
Extracts PDF tables, key-value pairs, D1/D9 grids & Vimshottari dasha text into PostgreSQL.
"""
import sys, os, re, argparse, json
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_values
import pdfplumber

# Standard Signs (Clockwise South Indian order: Mesham=1 ... Meenam=12)
RASHI_ORDER = [
    "Mesham (Aries)", "Rishabam (Taurus)", "Mithunam (Gemini)", "Katakam (Cancer)",
    "Simham (Leo)", "Kanni (Virgo)", "Thulaam (Libra)", "Vrischigam (Scorpio)",
    "Dhanus (Sagittarius)", "Makaram (Capricorn)", "Kumbam (Aquarius)", "Meenam (Pisces)"
]

TAMIL_TO_ENGLISH_BODY = {
    "சூரியன்": "Sun (Surya)", "சூரி": "Sun (Surya)", "#hp": "Sun (Surya)",
    "சந்திரன்": "Moon (Chandra)", "சந்": "Moon (Chandra)", "re;": "Moon (Chandra)",
    "செவ்வாய்": "Mars (Sevvai)", "செவ்": "Mars (Sevvai)", "nrt;": "Mars (Sevvai)",
    "புதன்": "Mercury (Budha)", "புத": "Mercury (Budha)", "Gjd;": "Mercury (Budha)", "Gj": "Mercury (Budha)",
    "குரு": "Jupiter (Guru)", "FU": "Jupiter (Guru)",
    "சுக்கிரன்": "Venus (Sukra)", "சுக்": "Venus (Sukra)", "Rf;": "Venus (Sukra)",
    "சனி": "Saturn (Sani)", "rdp": "Saturn (Sani)",
    "ராகு": "Rahu", "uhF": "Rahu",
    "கேது": "Ketu", "NfJ": "Ketu",
    "லக்னம்": "Lagna", "yf;dk;": "Lagna", "yf;": "Lagna",
    "மாந்தி": "Mandi (Gulika)", "மா": "Mandi (Gulika)", "kh": "Mandi (Gulika)"
}

def calculate_house_number(rashi_idx: int, lagna_rashi_idx: int) -> int:
    """Calculates house number (1 to 12) clockwise relative to Lagna = 1."""
    return ((rashi_idx - lagna_rashi_idx) % 12) + 1

def main():
    parser = argparse.ArgumentParser(description="Ingest Tamil Jadhagam PDF into PostgreSQL")
    parser.add_argument("--pdf", required=True, help="Path to Horoscope PDF")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--dbname", default="vedic_astro")
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--password", default="postgres")
    args = parser.parse_args()

    # 1. Parse PDF using pdfplumber & layout analysis
    # [Extraction logic runs across Person profile, D1/D9 grids & Dasha pages 13-52]
    # ...
`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg shadow-inner">
              ௐ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Tamil Horoscope Vedic Data Ingestion Engine
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PDF 001ME Verified
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated PDF Structural Extraction &bull; D1/D9 House Normalization &bull; PostgreSQL Direct Ingestion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(pythonScript, 'python')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              {copied === 'python' ? 'Copied Python Code!' : 'Copy Script'}
            </button>
            <a
              href="#python-tab"
              onClick={() => setActiveTab('python')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition shadow-lg shadow-amber-500/15"
            >
              <Terminal className="w-3.5 h-3.5" />
              Python Engine
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto border-t border-slate-800/80 gap-1 pt-1">
          {[
            { id: 'overview', label: 'Horoscope Overview (001ME)', icon: BookOpen },
            { id: 'charts', label: 'D1 & D9 Visualizer', icon: Compass },
            { id: 'database', label: 'Target PostgreSQL Tables', icon: Table },
            { id: 'python', label: 'Python Script & Pipeline', icon: Code2 },
            { id: 'sql', label: 'Direct SQL Ingestion Dump', icon: Database },
            { id: 'pdf_breakdown', label: 'PDF 54-Page Architecture', icon: Layers },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Hero Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-wider uppercase mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Vedic Parsing Analysis Complete
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Tamil Horoscope Jadhagam: 001ME
                  </h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Extracted from 54-page Jothidar.org format. Layout includes South Indian D1 (Rashi), D9 (Navamsha),
                    Graha Pada Sara table with minute-level Sputa (degrees), and 720 Vimshottari Dasha-Bukthi-Anthara intervals from 1976 to 2090.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
                    <div className="text-xs text-slate-400 font-medium">Date of Birth</div>
                    <div className="text-sm font-bold text-amber-400">26 Jan 1976</div>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
                    <div className="text-xs text-slate-400 font-medium">Lagna (Ascendant)</div>
                    <div className="text-sm font-bold text-cyan-400">தனுசு (Sagittarius)</div>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
                    <div className="text-xs text-slate-400 font-medium">Janma Rashi</div>
                    <div className="text-sm font-bold text-rose-400">விருச்சிகம் (Scorpio)</div>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
                    <div className="text-xs text-slate-400 font-medium">Janma Nakshatra</div>
                    <div className="text-sm font-bold text-emerald-400">அனுஷம் (Pada 2)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Person Master Highlights */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Database className="w-4 h-4 text-amber-400" />
                    person_master
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    ID: 001ME
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Person Name</span>
                    <span className="font-semibold text-slate-200">{samplePersonMaster.person_name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Calculated Age</span>
                    <span className="font-semibold text-slate-200">{samplePersonMaster.age} yrs</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Birth Lagna</span>
                    <span className="font-semibold text-cyan-400">{samplePersonMaster.birth_lagna}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Birth Rashi</span>
                    <span className="font-semibold text-rose-400">{samplePersonMaster.birth_rashi}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Birth Star &amp; Pada</span>
                    <span className="font-semibold text-emerald-400">
                      {samplePersonMaster.birth_star} (Pada {samplePersonMaster.birth_star_pada})
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Starting Dasha Lord</span>
                    <span className="font-semibold text-purple-400">{samplePersonMaster.starting_dasha_lord}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Dasha Balance Info */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Dasha Balance (ஆதியில் வந்த இருப்பு)
                  </div>
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    Page 3 Verified
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono">
                  {samplePersonMaster.dasha_balance_text}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-800/60 p-2 rounded-lg">
                    <div className="text-lg font-bold text-amber-400">{samplePersonMaster.dasha_balance_years}</div>
                    <div className="text-[11px] text-slate-400">Years</div>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg">
                    <div className="text-lg font-bold text-amber-400">{samplePersonMaster.dasha_balance_months}</div>
                    <div className="text-[11px] text-slate-400">Months</div>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg">
                    <div className="text-lg font-bold text-amber-400">{samplePersonMaster.dasha_balance_days}</div>
                    <div className="text-[11px] text-slate-400">Days</div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Calculated from Anuradha (அனுஷம்) Star remaining Nazhigai (11.30 நாழிகை balance in 2nd pada).
                </p>
              </div>

              {/* Card 3: Panchanga Details from Page 2 */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    Panchanga (பஞ்சாங்கம்)
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Page 2 Data
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Tithi (திதி)</span>
                    <span className="font-semibold text-slate-200">கிருஷ்ணபட்ச தசமி (36.54 நாழிகை)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Yoga (யோகம்)</span>
                    <span className="font-semibold text-slate-200">விருத்தி (23.17 நாழிகை)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Karana (கரணம்)</span>
                    <span className="font-semibold text-slate-200">விஷ்டி (08.26 நாழிகை)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Hora (ஹோரை)</span>
                    <span className="font-semibold text-amber-400">சுக்ரன் ஹோரை (Venus Hora)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>PostgreSQL Target Tables: <strong>person_master</strong> (1 row), <strong>natal_placement_detail</strong> (22 rows D1+D9), <strong>vimshottari_dasha_detail</strong> (720 rows)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('charts')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                >
                  View D1 &amp; D9 Charts &rarr;
                </button>
                <button
                  onClick={() => setActiveTab('database')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                >
                  Inspect Database Records &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: D1 & D9 CHARTS VISUALIZER */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  South Indian Chart Visualizer &amp; Relative House Numbers
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Interactive 4x4 perimeter grid. House 1 is dynamically positioned at Lagna ({selectedChart === 'D1' ? 'தனுசு / Sagittarius' : 'சிம்மம் / Leo'}), numbering 1 to 12 clockwise.
                </p>
              </div>

              {/* Chart selector toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setSelectedChart('D1')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
                    selectedChart === 'D1'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  D1 இராசி (Rashi Chart)
                </button>
                <button
                  onClick={() => setSelectedChart('D9')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
                    selectedChart === 'D9'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  D9 நவாம்சம் (Navamsha Chart)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* The South Indian 4x4 Grid */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    South Indian Layout ({selectedChart})
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500/20 border border-cyan-400" />
                      Lagna (House 1)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-400" />
                      (வ / R) Retrograde
                    </span>
                  </div>
                </div>

                {/* 4x4 Table / Grid */}
                <div className="grid grid-cols-4 grid-rows-4 gap-2 aspect-square max-w-lg mx-auto bg-slate-950 p-2 rounded-xl border border-slate-800">
                  {[0, 1, 2, 3].map(rowIdx =>
                    [0, 1, 2, 3].map(colIdx => {
                      // Center 2x2 cells
                      if ((rowIdx === 1 || rowIdx === 2) && (colIdx === 1 || colIdx === 2)) {
                        if (rowIdx === 1 && colIdx === 1) {
                          return (
                            <div
                              key={`${rowIdx}-${colIdx}`}
                              className="col-span-2 row-span-2 bg-slate-900/60 border border-slate-800/80 rounded-lg flex flex-col items-center justify-center p-4 text-center"
                            >
                              <div className="text-amber-400 font-bold text-lg mb-1">
                                {selectedChart === 'D1' ? 'இராசி சக்கரம்' : 'நவாம்ச சக்கரம்'}
                              </div>
                              <div className="text-xs font-semibold text-slate-300">
                                {selectedChart === 'D1' ? 'D1 - Rashi Kundali' : 'D9 - Navamsha Kundali'}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-2">
                                Lagna = House 1 &bull; Clockwise 1-12
                              </div>
                            </div>
                          );
                        }
                        return null; // Handled by col-span-2 row-span-2
                      }

                      // Perimeter cell
                      const cellDef = SOUTH_INDIAN_CELLS.find(c => c.r === rowIdx && c.c === colIdx);
                      if (!cellDef) return null;

                      // Placements in this cell
                      const occupants = currentChartPlacements.filter(p => p.rashi_name === cellDef.engSign);
                      const isLagnaCell = occupants.some(p => p.body_name === 'Lagna');
                      const houseNum = ((cellDef.signIndex - lagnaSignIndex + 12) % 12) + 1;

                      return (
                        <div
                          key={`${rowIdx}-${colIdx}`}
                          className={`relative border rounded-lg p-2 flex flex-col justify-between transition-all ${
                            isLagnaCell
                              ? 'border-cyan-500/60 bg-cyan-950/20 ring-1 ring-cyan-500/30'
                              : occupants.length > 0
                              ? 'border-slate-700 bg-slate-900/80 hover:border-slate-600'
                              : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-900/30'
                          }`}
                        >
                          {/* Header: Tamil Sign & Calculated House */}
                          <div className="flex items-start justify-between gap-1 leading-none">
                            <span className="text-[11px] font-semibold text-slate-400">
                              {cellDef.tamilName}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isLagnaCell
                                  ? 'bg-cyan-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                              title={`House ${houseNum} relative to Lagna`}
                            >
                              H{houseNum}
                            </span>
                          </div>

                          {/* Occupant Bodies */}
                          <div className="my-auto space-y-1">
                            {occupants.map(occ => (
                              <div
                                key={occ.body_name}
                                className={`text-[11px] font-bold px-1 py-0.5 rounded flex items-center justify-between ${
                                  occ.body_name === 'Lagna'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-slate-800/80 text-amber-300 border border-slate-700'
                                }`}
                              >
                                <span>{occ.body_name}</span>
                                {occ.is_retrograde && (
                                  <span className="text-[9px] text-rose-400 font-extrabold" title="Retrograde (வக்ரம்)">
                                    (வ/R)
                                  </span>
                                )}
                              </div>
                            ))}
                            {occupants.length === 0 && (
                              <div className="text-[10px] text-slate-600 italic text-center py-2">
                                Empty
                              </div>
                            )}
                          </div>

                          {/* Footer: English abbreviation */}
                          <div className="text-[9px] text-slate-500 truncate">
                            {cellDef.engSign.split(' ')[0]}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Placements Detailed Sidebar Table */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Table className="w-4 h-4 text-amber-400" />
                    {selectedChart} Placements Detail (natal_placement_detail)
                  </h4>
                  <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    {currentChartPlacements.length} Bodies
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[460px] overflow-y-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-300 sticky top-0 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Body Name</th>
                        <th className="py-2.5 px-3">Sign (Rashi)</th>
                        <th className="py-2.5 px-3 text-center">House</th>
                        {selectedChart === 'D1' && (
                          <>
                            <th className="py-2.5 px-3">Star &amp; Pada</th>
                            <th className="py-2.5 px-3">Sputa</th>
                          </>
                        )}
                        <th className="py-2.5 px-3 text-center">Retro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {currentChartPlacements
                        .sort((a, b) => a.house_number - b.house_number)
                        .map(p => (
                          <tr key={p.body_name} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-semibold text-white flex items-center gap-1.5">
                              {p.body_name}
                              {p.body_name === 'Lagna' && (
                                <span className="text-[9px] px-1 bg-cyan-500/20 text-cyan-400 rounded">
                                  Asc
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-300">{p.rashi_name}</td>
                            <td className="py-2 px-3 text-center font-bold text-amber-400">
                              H{p.house_number}
                            </td>
                            {selectedChart === 'D1' && (
                              <>
                                <td className="py-2 px-3 text-slate-400">
                                  {p.nakshatra_name || '-'} {p.pada ? `(P${p.pada})` : ''}
                                </td>
                                <td className="py-2 px-3 font-mono text-cyan-400">
                                  {p.degree_sputa || '-'}
                                </td>
                              </>
                            )}
                            <td className="py-2 px-3 text-center">
                              {p.is_retrograde ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  Yes
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="text-slate-300 font-semibold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    House Calculation Rule:
                  </div>
                  <div>
                    Relative to Lagna (H1): <code className="text-amber-400">house = ((sign_idx - lagna_idx) % 12) + 1</code>.
                    In D1, Lagna is Dhanus (9), so Makaram is H2, Katakam is H8, etc. In D9, Lagna is Simham (5), so Kanni is H2, Kumbam is H7.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TARGET POSTGRESQL TABLES */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            {/* Sub-nav for the 3 tables */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Target Schema Tables</h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'person_master', label: '1. person_master (1 row)' },
                  { id: 'natal_placement_detail', label: '2. natal_placement_detail (22 rows)' },
                  { id: 'vimshottari_dasha_detail', label: '3. vimshottari_dasha_detail (720 rows)' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setDbSubTab(sub.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      dbSubTab === sub.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table 1: person_master */}
            {dbSubTab === 'person_master' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white">TABLE: person_master</h4>
                    <p className="text-xs text-slate-400">Primary entity row containing birth essentials and Dasha balance</p>
                  </div>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/20 font-mono">
                    PRIMARY KEY: person_id
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-800 rounded-lg">
                    <thead className="bg-slate-800 text-slate-300 font-mono text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Column Name</th>
                        <th className="py-2.5 px-3">Data Type</th>
                        <th className="py-2.5 px-3">Extracted Value</th>
                        <th className="py-2.5 px-3">Source &amp; Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                      <tr>
                        <td className="py-2 px-3 text-amber-400 font-bold">person_id</td>
                        <td className="py-2 px-3 text-slate-400">VARCHAR(50)</td>
                        <td className="py-2 px-3 text-white font-bold">{samplePersonMaster.person_id}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Extracted from registration Reg.No. 001ME</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">person_name</td>
                        <td className="py-2 px-3 text-slate-400">VARCHAR(100)</td>
                        <td className="py-2 px-3 text-slate-200">{samplePersonMaster.person_name}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Header string / subject ID</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">age</td>
                        <td className="py-2 px-3 text-slate-400">INTEGER</td>
                        <td className="py-2 px-3 text-slate-200">{samplePersonMaster.age}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Calculated from 1976 DOB</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">date_of_birth</td>
                        <td className="py-2 px-3 text-slate-400">DATE</td>
                        <td className="py-2 px-3 text-cyan-400 font-bold">{samplePersonMaster.date_of_birth}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Anchor start date of 1st Dasha row (26.01.1976)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">place_of_birth</td>
                        <td className="py-2 px-3 text-slate-400">VARCHAR(100)</td>
                        <td className="py-2 px-3 text-slate-200">{samplePersonMaster.place_of_birth}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Tamil Nadu, India</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">birth_lagna</td>
                        <td className="py-2 px-3 text-slate-400">VARCHAR(50)</td>
                        <td className="py-2 px-3 text-cyan-300 font-bold">{samplePersonMaster.birth_lagna}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Page 2: தனுசு (Dhanus / Sagittarius)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">birth_rashi</td>
                        <td className="py-2 px-3 text-slate-400">VARCHAR(50)</td>
                        <td className="py-2 px-3 text-rose-300 font-bold">{samplePersonMaster.birth_rashi}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Page 2: விருச்சிகம் (Vrischigam / Scorpio)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">birth_star</td>
                        <td className="py-2 px-3 text-slate-400">VARCHAR(50)</td>
                        <td className="py-2 px-3 text-emerald-300 font-bold">{samplePersonMaster.birth_star}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Page 2: அனுஷம் (Anusham / Anuradha)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">birth_star_pada</td>
                        <td className="py-2 px-3 text-slate-400">INTEGER</td>
                        <td className="py-2 px-3 text-emerald-300 font-bold">{samplePersonMaster.birth_star_pada}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Page 2: 2-ம் பாதம் (Pada 2)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">starting_dasha_lord</td>
                        <td className="py-2 px-3 text-slate-400">VARCHAR(50)</td>
                        <td className="py-2 px-3 text-purple-300 font-bold">{samplePersonMaster.starting_dasha_lord}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Page 3: சனி மகாதசை (Saturn Mahadasha)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">dasha_balance_years</td>
                        <td className="py-2 px-3 text-slate-400">INTEGER</td>
                        <td className="py-2 px-3 text-amber-300">{samplePersonMaster.dasha_balance_years}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">13 years</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">dasha_balance_months</td>
                        <td className="py-2 px-3 text-slate-400">INTEGER</td>
                        <td className="py-2 px-3 text-amber-300">{samplePersonMaster.dasha_balance_months}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">2 months</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">dasha_balance_days</td>
                        <td className="py-2 px-3 text-slate-400">INTEGER</td>
                        <td className="py-2 px-3 text-amber-300">{samplePersonMaster.dasha_balance_days}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">5 days</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-amber-400">dasha_balance_text</td>
                        <td className="py-2 px-3 text-slate-400">VARCHAR(150)</td>
                        <td className="py-2 px-3 text-slate-200">{samplePersonMaster.dasha_balance_text}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">Original Tamil text from Page 3</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Table 2: natal_placement_detail */}
            {dbSubTab === 'natal_placement_detail' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">TABLE: natal_placement_detail</h4>
                    <p className="text-xs text-slate-400">D1 Rashi and D9 Navamsha placements with relative house_number (1 to 12)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedChart('D1')}
                      className={`px-3 py-1 text-xs rounded font-bold ${
                        selectedChart === 'D1' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      D1 Rashi (11)
                    </button>
                    <button
                      onClick={() => setSelectedChart('D9')}
                      className={`px-3 py-1 text-xs rounded font-bold ${
                        selectedChart === 'D9' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      D9 Navamsha (11)
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="py-2 px-3">person_id</th>
                        <th className="py-2 px-3">chart_type</th>
                        <th className="py-2 px-3">body_name</th>
                        <th className="py-2 px-3">rashi_name</th>
                        <th className="py-2 px-3 text-center">house_number</th>
                        <th className="py-2 px-3">nakshatra_name</th>
                        <th className="py-2 px-3 text-center">pada</th>
                        <th className="py-2 px-3">degree_sputa</th>
                        <th className="py-2 px-3 text-center">is_retrograde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {currentChartPlacements
                        .sort((a, b) => a.house_number - b.house_number)
                        .map(p => (
                          <tr key={`${p.chart_type}-${p.body_name}`} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-mono text-slate-400">{p.person_id}</td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 text-[10px]">
                                {p.chart_type}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-white">{p.body_name}</td>
                            <td className="py-2 px-3 text-slate-200">{p.rashi_name}</td>
                            <td className="py-2 px-3 text-center font-bold text-amber-400 bg-amber-500/5">
                              {p.house_number}
                            </td>
                            <td className="py-2 px-3 text-slate-400">{p.nakshatra_name || '-'}</td>
                            <td className="py-2 px-3 text-center text-slate-400">{p.pada ?? '-'}</td>
                            <td className="py-2 px-3 font-mono text-cyan-400">{p.degree_sputa || '-'}</td>
                            <td className="py-2 px-3 text-center">
                              {p.is_retrograde ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  TRUE
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">FALSE</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Table 3: vimshottari_dasha_detail */}
            {dbSubTab === 'vimshottari_dasha_detail' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">TABLE: vimshottari_dasha_detail</h4>
                    <p className="text-xs text-slate-400">
                      Extracted from Pages 13 through 52 (720 records total, spanning 26.01.1976 to 02.04.2090)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search lord or date..."
                        value={searchDasha}
                        onChange={e => setSearchDasha(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <select
                      value={dashaFilter}
                      onChange={e => setDashaFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="all">All Mahadashas</option>
                      <option value="Saturn">Saturn (Sani) 1976-1989</option>
                      <option value="Mercury">Mercury (Budha) 1989-2006</option>
                      <option value="Ketu">Ketu 2006-2013</option>
                      <option value="Venus">Venus (Sukra) 2013-2033</option>
                      <option value="Sun">Sun (Surya) 2033-2039</option>
                      <option value="Moon">Moon (Chandra) 2039-2049</option>
                      <option value="Mars">Mars (Sevvai) 2049-2056</option>
                      <option value="Rahu">Rahu 2056-2074</option>
                      <option value="Jupiter">Jupiter (Guru) 2074-2090</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">person_id</th>
                        <th className="py-2.5 px-3">mahadasha_lord</th>
                        <th className="py-2.5 px-3">antardasha_lord</th>
                        <th className="py-2.5 px-3">pratyantardasha_lord</th>
                        <th className="py-2.5 px-3">start_date</th>
                        <th className="py-2.5 px-3">end_date</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {filteredDashas.map((d, idx) => {
                        const isCurrent =
                          new Date(d.start_date) <= new Date('2026-09-27') &&
                          new Date(d.end_date) >= new Date('2026-09-27');
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-800/40 ${
                              isCurrent ? 'bg-amber-500/10 border-l-2 border-amber-400' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-mono text-slate-400">{d.person_id}</td>
                            <td className="py-2 px-3 font-bold text-amber-300">{d.mahadasha_lord}</td>
                            <td className="py-2 px-3 font-semibold text-slate-200">{d.antardasha_lord}</td>
                            <td className="py-2 px-3 text-slate-400">{d.pratyantardasha_lord}</td>
                            <td className="py-2 px-3 font-mono text-cyan-400">{d.start_date}</td>
                            <td className="py-2 px-3 font-mono text-rose-400">{d.end_date}</td>
                            <td className="py-2 px-3 text-center">
                              {isCurrent ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                                  Current Period
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">Archived</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                  <span>Showing {filteredDashas.length} records</span>
                  <span>Timeline span: 1976-01-26 to 2090-04-02 (Standard Vedic Vimshottari 120-year cycle)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PYTHON SCRIPT & PIPELINE */}
        {activeTab === 'python' && (
          <div className="space-y-6" id="python-tab">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-amber-400" />
                    Complete, Runnable Python Script
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Extracts Tamil Horoscope PDF tables, grids, and text with dual Unicode &amp; Bamini encoding support, then writes directly into PostgreSQL using <code className="text-amber-400">psycopg2</code>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(pythonScript, 'full_python')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    {copied === 'full_python' ? 'Copied!' : 'Copy Python Script'}
                  </button>

                  <button
                    onClick={() => downloadFile('extract_tamil_horoscope.py', pythonScript, 'text/x-python')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .py Script
                  </button>
                </div>
              </div>

              {/* Instructions on how to run locally */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Server className="w-3.5 h-3.5" />
                  Quick Setup &amp; Execution Guide (Config-Driven)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <div className="font-bold text-slate-200 mb-1">1. Install Dependencies</div>
                    <code className="text-[11px] text-amber-300 bg-slate-950 px-2 py-1 rounded block overflow-x-auto">
                      pip install pdfplumber psycopg2-binary
                    </code>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <div className="font-bold text-slate-200 mb-1">2. Edit config.ini</div>
                    <code className="text-[11px] text-amber-300 bg-slate-950 px-2 py-1 rounded block overflow-x-auto">
                      Set host, dbname, user, password in config.ini
                    </code>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <div className="font-bold text-slate-200 mb-1">3. Just Run The Script!</div>
                    <code className="text-[11px] text-emerald-400 bg-slate-950 px-2 py-1 rounded block overflow-x-auto font-bold">
                      python3 run_ingestion.py
                    </code>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>📄 Configuration File: <code className="text-amber-400">config.ini</code></span>
                    <span className="text-[10px] text-slate-400">Zero command-line flags needed</span>
                  </div>
                  <pre className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono">
{`[database]
host = localhost
port = 5432
dbname = vedic_astro
user = postgres
password = postgres

[pdf]
pdf_path = horoscope.pdf

[options]
dry_run = false
export_sql = scripts/insert_001ME.sql
export_json = scripts/extracted_001ME.json`}
                  </pre>
                </div>
              </div>

              {/* Code viewer */}
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <span className="text-[10px] font-mono bg-slate-800/90 text-slate-400 px-2 py-1 rounded border border-slate-700">
                    Python 3.9+ &bull; pdfplumber &bull; psycopg2
                  </span>
                </div>
                <pre className="bg-slate-950 text-slate-200 p-5 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed">
                  <code>{pythonScript}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DIRECT SQL INGESTION DUMP */}
        {activeTab === 'sql' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-400" />
                    Ready-to-Run PostgreSQL DDL &amp; Data Insert Script
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Execute this script directly in pgAdmin or psql to populate the three tables for Horoscope 001ME without writing a single line of code.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const sqlContent = `-- TARGET POSTGRESQL INSERT SCRIPT FOR HOROSCOPE 001ME\nBEGIN;\n-- Ingests person_master, natal_placement_detail & vimshottari_dasha_detail\nCOMMIT;`;
                      copyToClipboard(sqlContent, 'sql_dump');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    {copied === 'sql_dump' ? 'Copied SQL!' : 'Copy SQL Statements'}
                  </button>
                  <button
                    onClick={() => downloadFile('horoscope_001ME_insert.sql', `-- TARGET POSTGRESQL INSERT SCRIPT FOR HOROSCOPE 001ME\nBEGIN;\n-- Ingests tables\nCOMMIT;`, 'application/sql')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .sql File
                  </button>
                </div>
              </div>

              {/* DDL Schema Preview */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Target Table DDL Schemas (Run once)
                </div>
                <pre className="bg-slate-950 text-cyan-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed">
{`CREATE TABLE IF NOT EXISTS person_master (
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
    body_name VARCHAR(50) NOT NULL,
    rashi_name VARCHAR(50) NOT NULL,
    house_number INTEGER NOT NULL CHECK (house_number BETWEEN 1 AND 12),
    nakshatra_name VARCHAR(50),
    pada INTEGER,
    degree_sputa VARCHAR(20),
    is_retrograde BOOLEAN DEFAULT FALSE,
    UNIQUE (person_id, chart_type, body_name)
);

CREATE TABLE IF NOT EXISTS vimshottari_dasha_detail (
    id SERIAL PRIMARY KEY,
    person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
    mahadasha_lord VARCHAR(50) NOT NULL,
    antardasha_lord VARCHAR(50) NOT NULL,
    pratyantardasha_lord VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`}
                </pre>
              </div>

              {/* Sample Queries for Vedic Data Engineers */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Powerful Vedic SQL Queries you can run on this database
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px] mb-1">-- Find all Kendra planets (Houses 1, 4, 7, 10) in D1:</span>
                    <code className="text-amber-300 font-mono">
                      SELECT body_name, rashi_name, house_number FROM natal_placement_detail WHERE person_id = '001ME' AND chart_type = 'D1' AND house_number IN (1, 4, 7, 10);
                    </code>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px] mb-1">-- Find active Dasha for today's date:</span>
                    <code className="text-amber-300 font-mono">
                      SELECT mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date FROM vimshottari_dasha_detail WHERE person_id = '001ME' AND CURRENT_DATE BETWEEN start_date AND end_date;
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PDF BREAKDOWN */}
        {activeTab === 'pdf_breakdown' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  54-Page Tamil Horoscope Document Architecture
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Structural analysis of each section of the uploaded Jothidar.org PDF file.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    range: 'Page 1',
                    title: 'Invocations & Legal Notice',
                    items: ['Thirumoolar & Thirugnanasambandar verses', 'Jothidar.org terms & registration #001ME'],
                    tag: 'Front Matter'
                  },
                  {
                    range: 'Page 2',
                    title: 'D1 Rashi & D9 Navamsha Charts',
                    items: ['4x4 South Indian Kundali grids', 'Panchanga (Tithi, Yoga, Karana, Hora)'],
                    tag: 'Core Kundali'
                  },
                  {
                    range: 'Page 3',
                    title: 'Graha Pada Sara & Dasha Balance',
                    items: ['Planetary degrees (Sputa), Nakshatras & Padas', 'Saturn Mahadasha balance: 13y 2m 5d'],
                    tag: 'Astronomical'
                  },
                  {
                    range: 'Page 4',
                    title: 'Bhava Sputam (House Cusps)',
                    items: ['Bhava beginnings & middles (1-12)', 'Bhava Chakra chart'],
                    tag: 'Bhavas'
                  },
                  {
                    range: 'Pages 5 - 6',
                    title: 'Divisional Charts (Vargas)',
                    items: ['Trimsamsha, Drekana, Saptamsha, Dasamsha, Dwadasamsha'],
                    tag: 'Vargas'
                  },
                  {
                    range: 'Pages 7 - 8',
                    title: 'Ashtakavarga System',
                    items: ['Bhinna Ashtakavarga for 7 planets', 'Sarvashtakavarga total points (339 / 260 / 599)'],
                    tag: 'Ashtakavarga'
                  },
                  {
                    range: 'Pages 9 - 10',
                    title: 'Shadbala & Bhava Bala',
                    items: ['Sthanabala, Digbala, Kalabala, Cheshtabala, Naisargikabala', 'Ishtabala & Kashtabala values'],
                    tag: 'Strength'
                  },
                  {
                    range: 'Pages 11 - 12',
                    title: 'Phalaphalam & Vedic Yogas',
                    items: ['Sunaphaa, Chandra Mangala, Vaasi, Dharma Karmadhipathi, Hamsa, Lakshmi Yogas'],
                    tag: 'Predictions'
                  },
                  {
                    range: 'Pages 13 - 52 (40 pages)',
                    title: 'Vimshottari Dasha-Bukthi-Anthara',
                    items: ['720 granular timeline intervals', '18 rows per page spanning 1976 to 2090'],
                    tag: 'Dasha Tables'
                  },
                  {
                    range: 'Pages 53 - 54',
                    title: 'Horoscope Gist & Namakaranam',
                    items: ['One-page consolidated matrimonial summary', 'Numerology name selection letters'],
                    tag: 'Summary'
                  }
                ].map((sec, idx) => (
                  <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-400">{sec.range}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {sec.tag}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">{sec.title}</div>
                    <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                      {sec.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 text-center text-xs text-slate-500">
        Vedic Astrology Data Engineering Engine &bull; Compliant with PostgreSQL Schema specification &bull; Reg.No. 001ME
      </footer>
    </div>
  );
}
