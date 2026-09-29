import React, { useState, useMemo } from 'react';
import {
  Server,
  Play,
  Copy,
  Download,
  CheckCircle2,
  Calendar,
  Clock,
  Database,
  Sparkles,
  Code2,
  Search,
  ArrowRight,
  Terminal,
  RefreshCw,
  Hash,
  Table,
  Compass,
  AlertCircle,
  Globe,
  Orbit,
  Eye,
  FileText,
  ShieldCheck
} from 'lucide-react';
import {
  HoroscopeApiResponse,
  UserQueryLog,
  executeHoroscopeTimelineQuery,
  normalizeDateString,
  generateLlmMarkdown
} from '../data/apiService';

interface RestApiStudioProps {
  apiPersonId: string;
  setApiPersonId: (id: string) => void;
  apiStartDate: string;
  setApiStartDate: (d: string) => void;
  apiEndDate: string;
  setApiEndDate: (d: string) => void;
  apiResponse: HoroscopeApiResponse | null;
  setApiResponse: (res: HoroscopeApiResponse) => void;
  queryHistory: UserQueryLog[];
  setQueryHistory: React.Dispatch<React.SetStateAction<UserQueryLog[]>>;
  copyToClipboard: (text: string, label: string) => void;
  copied: string | null;
  downloadFile: (filename: string, content: string, type: string) => void;
}

export default function RestApiStudio({
  apiPersonId,
  setApiPersonId,
  apiStartDate,
  setApiStartDate,
  apiEndDate,
  setApiEndDate,
  apiResponse,
  setApiResponse,
  queryHistory,
  setQueryHistory,
  copyToClipboard,
  copied,
  downloadFile
}: RestApiStudioProps) {
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'natal' | 'transit' | 'markdown' | 'json' | 'clients' | 'audit'>('transit');
  const [dashaSearch, setDashaSearch] = useState('');
  const [selectedChartType, setSelectedChartType] = useState<'D1' | 'D9'>('D1');
  const [transitViewMode, setTransitViewMode] = useState<'snapshot_start' | 'snapshot_end' | 'timeline_events'>('snapshot_start');
  const [transitSearch, setTransitSearch] = useState('');
  const [markdownView, setMarkdownView] = useState<'preview' | 'raw'>('preview');

  const handleRunQuery = () => {
    setLoading(true);
    setTimeout(() => {
      const res = executeHoroscopeTimelineQuery(apiPersonId, apiStartDate, apiEndDate);
      setApiResponse(res);
      setQueryHistory(prev => [
        {
          query_id: res.unique_response_id,
          running_number: res.running_number,
          person_id: res.person_id,
          start_date: res.requested_timeline.start_date,
          end_date: res.requested_timeline.end_date,
          created_at: res.server_timestamp,
          response_payload: res
        },
        ...prev.slice(0, 29)
      ]);
      setLoading(false);
    }, 200);
  };

  const applyPreset = (start: string, end: string) => {
    setApiStartDate(start);
    setApiEndDate(end);
    setLoading(true);
    setTimeout(() => {
      const res = executeHoroscopeTimelineQuery(apiPersonId, start, end);
      setApiResponse(res);
      setQueryHistory(prev => [
        {
          query_id: res.unique_response_id,
          running_number: res.running_number,
          person_id: res.person_id,
          start_date: res.requested_timeline.start_date,
          end_date: res.requested_timeline.end_date,
          created_at: res.server_timestamp,
          response_payload: res
        },
        ...prev.slice(0, 29)
      ]);
      setLoading(false);
    }, 150);
  };

  // Filter dasha intervals based on user search
  const filteredIntervals = useMemo(() => {
    if (!apiResponse) return [];
    const list = apiResponse.vimshottari_dasha_intervals.intervals;
    if (!dashaSearch.trim()) return list;
    const q = dashaSearch.toLowerCase();
    return list.filter(
      item =>
        item.mahadasha_lord_md.toLowerCase().includes(q) ||
        item.antardasha_lord_ad.toLowerCase().includes(q) ||
        item.pratyantardasha_lord_pd.toLowerCase().includes(q) ||
        item.start_date.includes(q) ||
        item.end_date.includes(q)
    );
  }, [apiResponse, dashaSearch]);

  const jsonString = useMemo(() => {
    return apiResponse ? JSON.stringify(apiResponse, null, 2) : '';
  }, [apiResponse]);

  const llmMarkdownString = useMemo(() => {
    return apiResponse ? generateLlmMarkdown(apiResponse) : '';
  }, [apiResponse]);

  const llmTokenEst = useMemo(() => Math.round(llmMarkdownString.length / 4), [llmMarkdownString]);
  const jsonTokenEst = useMemo(() => Math.round(jsonString.length / 4), [jsonString]);

  const curlCommand = `curl -X POST http://localhost:5000/api/horoscope/query \\
  -H "Content-Type: application/json" \\
  -d '{
    "person_id": "${apiPersonId}",
    "start_date": "${apiStartDate}",
    "end_date": "${apiEndDate}"
  }'`;

  const curlMarkdownCommand = `curl -X POST "http://localhost:5000/api/horoscope/query?format=llm_markdown" \\
  -H "Content-Type: application/json" \\
  -d '{
    "person_id": "${apiPersonId}",
    "start_date": "${apiStartDate}",
    "end_date": "${apiEndDate}",
    "format": "llm_markdown"
  }'`;

  const pythonClientCode = `import requests
import json

# Request Model 2 REST API endpoint (Default Full JSON with All Details)
url = "http://localhost:5000/api/horoscope/query"
payload = {
    "person_id": "${apiPersonId}",
    "start_date": "${apiStartDate}",  # e.g. "January 1998" or "1998-01-01"
    "end_date": "${apiEndDate}"       # e.g. "January 2020" or "2020-01-31"
}

response = requests.post(url, json=payload)
data = response.json()

print(f"Unique Tag:    {data['unique_response_id']}")
print(f"Running Num:   {data['running_number']} (Cycle 1..100)")
print(f"Total PDs:     {data['vimshottari_dasha_intervals']['total_intervals_count']} intervals found")
print(f"Stored in DB:  {data['persisted_in_database']['table']}")
`;

  const pythonMarkdownClientCode = `import requests

# Request Option B: High-Density LLM Markdown (Strictly Sanitized - Zero PII)
url = "http://localhost:5000/api/horoscope/query"
payload = {
    "person_id": "${apiPersonId}",
    "start_date": "${apiStartDate}",
    "end_date": "${apiEndDate}",
    "format": "llm_markdown"   # Automatically strips name, age, DOB, POB, and Tamil text
}

response = requests.post(url, json=payload)
prompt_markdown = response.text  # Direct Markdown text ready to inject into LLM system/user prompt!

print(f"Prompt Size: {len(prompt_markdown)} characters (~{len(prompt_markdown)//4} tokens)")
print(prompt_markdown[:400])

# Ready to pass to Google Gemini or Anthropic Claude:
# gemini_response = client.models.generate_content(
#     model="gemini-2.5-flash",
#     contents=[f"Astrological Data:\\n{prompt_markdown}\\n\\nTask: Analyze career & financial triggers between 2005 and 2010."]
# )
`;

  return (
    <div className="space-y-6">
      {/* Top Banner explaining Model 2 */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 tracking-wider uppercase mb-1">
              <Server className="w-4 h-4" />
              Model 2: Production REST API Query Engine
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Horoscope Timeline &amp; Natal Placement REST API
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Accepts <code className="text-amber-400 font-mono">person_id</code> and any requested timeline span
              (e.g., <em>January 1998 to January 2020</em>). Generates a standardized JSON response containing
              D1 &amp; D9 relative house placements, full granular Pratyantardasha (MD &gt; AD &gt; PD) intervals,
              a unique cycling 1..100 running number, and automatically audits the query into the PostgreSQL
              <code className="text-emerald-400 font-mono"> user_queries</code> transaction table.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
              <div className="text-xs text-slate-400 font-medium">API Server</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">port 5000</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
              <div className="text-xs text-slate-400 font-medium">Running Number</div>
              <div className="text-sm font-bold text-amber-400 font-mono">1 to 100 Cycle</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
              <div className="text-xs text-slate-400 font-medium">Granularity</div>
              <div className="text-sm font-bold text-cyan-400">PD (Anthara) Level</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
              <div className="text-xs text-slate-400 font-medium">Audit Table</div>
              <div className="text-sm font-bold text-purple-400 font-mono">user_queries</div>
            </div>
          </div>
        </div>
      </div>

      {/* Query Parameters Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">Execute REST API Query (`/api/horoscope/query`)</span>
          </div>
          <div className="text-xs text-slate-400">
            Accepts ISO format (<code className="text-slate-300">1998-01-01</code>) or Natural Language (<code className="text-slate-300">January 1998</code>)
          </div>
        </div>

        {/* Input fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              1. Person ID (Unique Identifier)
            </label>
            <input
              type="text"
              value={apiPersonId}
              onChange={e => setApiPersonId(e.target.value)}
              placeholder="e.g. 001ME"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-400 transition"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Registration ID from PDF footer</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              2. Timeline Start Date
            </label>
            <input
              type="text"
              value={apiStartDate}
              onChange={e => setApiStartDate(e.target.value)}
              placeholder="1998-01-01 or January 1998"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-cyan-400 font-mono focus:outline-none focus:border-cyan-400 transition"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Normalized to: {normalizeDateString(apiStartDate, false)}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              3. Timeline End Date
            </label>
            <input
              type="text"
              value={apiEndDate}
              onChange={e => setApiEndDate(e.target.value)}
              placeholder="2020-01-31 or January 2020"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-rose-400 font-mono focus:outline-none focus:border-rose-400 transition"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Normalized to: {normalizeDateString(apiEndDate, true)}</span>
          </div>
        </div>

        {/* Quick Presets & Run Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> Presets:
            </span>
            <button
              onClick={() => applyPreset('January 1998', 'January 2020')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
            >
              ⭐ 1998 to 2020 (User Prompt Period)
            </button>
            <button
              onClick={() => applyPreset('2000-01-01', '2005-12-31')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              2000 - 2005
            </button>
            <button
              onClick={() => applyPreset('2026-09-01', '2027-09-01')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Current Year (2026 - 2027)
            </button>
            <button
              onClick={() => applyPreset('1976-01-26', '1989-04-02')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Saturn Mahadasha (1976 - 1989)
            </button>
            <button
              onClick={() => applyPreset('1976-01-26', '2090-04-02')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Full Lifetime (1976 - 2090)
            </button>
          </div>

          <button
            onClick={handleRunQuery}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Querying REST Engine...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Send API Query &amp; Persist in DB
              </>
            )}
          </button>
        </div>
      </div>

      {/* Query Response Header & Metadata */}
      {apiResponse && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/20">
                  HTTP 200 OK
                </span>
                <div>
                  <span className="text-xs text-slate-400 mr-2">Unique Response Tag:</span>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                    {apiResponse.unique_response_id}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 mr-1.5">Running Number:</span>
                  <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold border border-indigo-500/30">
                    #{apiResponse.running_number} (Cycle {apiResponse.running_number}/100)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Persisted in Table: <strong>user_queries</strong></span>
                </div>
                <button
                  onClick={() => copyToClipboard(jsonString, 'json_resp')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  {copied === 'json_resp' ? 'Copied JSON!' : 'Copy JSON'}
                </button>
                <button
                  onClick={() =>
                    downloadFile(
                      `${apiResponse.unique_response_id}.json`,
                      jsonString,
                      'application/json'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  Download
                </button>
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-1">
            {[
              {
                id: 'timeline',
                label: `Vimshottari Dasha Intervals (${apiResponse.vimshottari_dasha_intervals.total_intervals_count})`,
                icon: Calendar
              },
              {
                id: 'natal',
                label: `Natal Placements (D1 & D9 Houses)`,
                icon: Compass
              },
              {
                id: 'transit',
                label: `Transit Ephemeris (9 Grahas Gochara)`,
                icon: Globe
              },
              {
                id: 'markdown',
                label: `🤖 LLM Markdown (Option B - Zero PII)`,
                icon: Sparkles
              },
              {
                id: 'json',
                label: `Full JSON Response Payload`,
                icon: Code2
              },
              {
                id: 'clients',
                label: `cURL & Python Client Snippets`,
                icon: Terminal
              },
              {
                id: 'audit',
                label: `user_queries Transaction Log (${queryHistory.length})`,
                icon: Database
              }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* SUB-TAB 1: TIMELINE INTERVALS (MD > AD > PD) */}
          {activeSubTab === 'timeline' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Granular Vimshottari Timeline Intervals (PD / Anthara Level)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Spanning <strong className="text-slate-200">{apiResponse.requested_timeline.start_date}</strong> to{' '}
                    <strong className="text-slate-200">{apiResponse.requested_timeline.end_date}</strong>{' '}
                    ({apiResponse.requested_timeline.span_years} years). Every single PD interval is included sequentially.
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search lord or date..."
                    value={dashaSearch}
                    onChange={e => setDashaSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {filteredIntervals.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No intervals found for this search or timeline range.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center">#</th>
                        <th className="py-2.5 px-3">Mahadasha (MD)</th>
                        <th className="py-2.5 px-3">Antardasha (AD / Bukthi)</th>
                        <th className="py-2.5 px-3">Pratyantardasha (PD / Anthara)</th>
                        <th className="py-2.5 px-3">Start Date</th>
                        <th className="py-2.5 px-3">End Date</th>
                        <th className="py-2.5 px-3 text-center">Duration</th>
                        <th className="py-2.5 px-3">Hierarchy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {filteredIntervals.map(item => (
                        <tr key={item.sequence_index} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-center font-mono text-slate-500">
                            {item.sequence_index}
                          </td>
                          <td className="py-2 px-3 font-bold text-amber-300">
                            {item.mahadasha_lord_md}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            {item.antardasha_lord_ad}
                          </td>
                          <td className="py-2 px-3 font-semibold text-purple-300">
                            {item.pratyantardasha_lord_pd}
                          </td>
                          <td className="py-2 px-3 font-mono text-cyan-400">
                            {item.start_date}
                          </td>
                          <td className="py-2 px-3 font-mono text-rose-400">
                            {item.end_date}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-400">
                            {item.duration_days ? `${item.duration_days}d` : '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                            {item.full_lord_hierarchy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>Showing {filteredIntervals.length} of {apiResponse.vimshottari_dasha_intervals.total_intervals_count} intervals</span>
                <span className="font-mono text-purple-400">Full MD &gt; AD &gt; PD Hierarchical Tree</span>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: NATAL PLACEMENTS (D1 & D9) */}
          {activeSubTab === 'natal' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    Natal Placements &amp; Relative House Numbers (Lagna = House 1)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Standardized English planetary bodies, sign names, minute-precision degrees (Sputa), and retrograde flags.
                  </p>
                </div>

                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setSelectedChartType('D1')}
                    className={`px-3 py-1 text-xs rounded font-bold transition ${
                      selectedChartType === 'D1' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    D1 Rashi Chart ({apiResponse.natal_placements.D1_rashi_chart.count} bodies)
                  </button>
                  <button
                    onClick={() => setSelectedChartType('D9')}
                    className={`px-3 py-1 text-xs rounded font-bold transition ${
                      selectedChartType === 'D9' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    D9 Navamsha Chart ({apiResponse.natal_placements.D9_navamsha_chart.count} bodies)
                  </button>
                </div>
              </div>

              {/* Table of placements */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Body Name</th>
                      <th className="py-2.5 px-3">Rashi (Sign)</th>
                      <th className="py-2.5 px-3 text-center">House (Relative to Lagna)</th>
                      <th className="py-2.5 px-3">Nakshatra (Star)</th>
                      <th className="py-2.5 px-3 text-center">Pada</th>
                      <th className="py-2.5 px-3">Degree (Sputa)</th>
                      <th className="py-2.5 px-3 text-center">Retrograde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {(selectedChartType === 'D1'
                      ? apiResponse.natal_placements.D1_rashi_chart.bodies
                      : apiResponse.natal_placements.D9_navamsha_chart.bodies
                    )
                      .sort((a, b) => a.house_number - b.house_number)
                      .map(p => (
                        <tr key={p.body_name} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-bold text-white flex items-center gap-1.5">
                            {p.body_name === 'Lagna' && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                            )}
                            {p.body_name}
                          </td>
                          <td className="py-2 px-3 text-slate-200">{p.rashi_name}</td>
                          <td className="py-2 px-3 text-center font-bold text-amber-400 bg-amber-500/5">
                            House {p.house_number}
                          </td>
                          <td className="py-2 px-3 text-slate-400">{p.nakshatra_name || '-'}</td>
                          <td className="py-2 px-3 text-center text-slate-400">{p.pada ?? '-'}</td>
                          <td className="py-2 px-3 font-mono text-cyan-400">{p.degree_sputa || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            {p.is_retrograde ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                RETROGRADE
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">DIRECT</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB: TRANSIT EPHEMERIS (GOCHARA) */}
          {activeSubTab === 'transit' && apiResponse.transit_ephemeris_timeline && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    Ephemeris Transit Engine (Gochara Timeline for 9 Grahas)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calculated with Lahiri (Chitra Paksha) Ayanamsha. Computes sign positions, exact minute sputa, nakshatra &amp; pada,
                    and houses relative to both Natal Lagna and Natal Janma Rashi.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setTransitViewMode('snapshot_start')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        transitViewMode === 'snapshot_start' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Start Snapshot ({apiResponse.requested_timeline.start_date})
                    </button>
                    <button
                      onClick={() => setTransitViewMode('snapshot_end')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        transitViewMode === 'snapshot_end' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      End Snapshot ({apiResponse.requested_timeline.end_date})
                    </button>
                    <button
                      onClick={() => setTransitViewMode('timeline_events')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        transitViewMode === 'timeline_events' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sign Ingress Events ({apiResponse.transit_ephemeris_timeline.major_transits_timeline_count})
                    </button>
                  </div>
                </div>
              </div>

              {/* Native's Reference Banner */}
              <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300">Native's Baseline Reference:</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                      Lagna: {apiResponse.transit_ephemeris_timeline.natal_reference.natal_lagna_sign}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                      Janma Rashi: {apiResponse.transit_ephemeris_timeline.natal_reference.natal_rashi_sign}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-300/90 font-mono">
                    Relative House Rule: ((Transit Sign - Baseline Sign) % 12) + 1
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  💡 <strong className="text-slate-200">User Specification Verified:</strong> When <strong>Jupiter (Guru)</strong> transits{' '}
                  <strong className="text-amber-300">Katakam (Cancer / Karka)</strong>, the engine calculates it as{' '}
                  <span className="text-cyan-400 font-bold">8th House (Ashtama)</span> from native's Dhanus Lagna, and{' '}
                  <span className="text-rose-400 font-bold">9th House (Bhagya)</span> from native's Vrischigam Moon sign.
                  Each and every Graha is calculated with both perspectives simultaneously!
                </div>
              </div>

              {/* 9 Graha Snapshot Table */}
              {(transitViewMode === 'snapshot_start' || transitViewMode === 'snapshot_end') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Graha (Planet)</th>
                        <th className="py-2.5 px-3">Transit Rashi (Sign)</th>
                        <th className="py-2.5 px-3">Degree (Sputa)</th>
                        <th className="py-2.5 px-3">Nakshatra &amp; Pada</th>
                        <th className="py-2.5 px-3 text-center bg-cyan-950/30 text-cyan-300">
                          Relative to Lagna (Dhanus)
                        </th>
                        <th className="py-2.5 px-3 text-center bg-rose-950/30 text-rose-300">
                          Relative to Moon (Vrischigam)
                        </th>
                        <th className="py-2.5 px-3 text-center">Motion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {(transitViewMode === 'snapshot_start'
                        ? apiResponse.transit_ephemeris_timeline.transit_snapshot_start
                        : apiResponse.transit_ephemeris_timeline.transit_snapshot_end
                      ).map(g => (
                        <tr key={g.graha_key} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                            <span>{g.graha_name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({g.graha_tamil})</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-amber-300">
                            {g.transit_rashi_name}{' '}
                            <span className="text-[10px] text-slate-400">({g.transit_rashi_tamil})</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400">
                            {g.degree_sputa}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <span className="font-semibold text-slate-200">{g.graha_pada_chara.nakshatra_name}</span>
                            <span className="text-amber-400 ml-1">Pada {g.graha_pada_chara.pada}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center bg-cyan-950/10">
                            <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                              House {g.relative_to_natal_lagna.house_number}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {g.relative_to_natal_lagna.house_title}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center bg-rose-950/10">
                            <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              House {g.relative_to_natal_rashi.house_number}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {g.relative_to_natal_rashi.house_title}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {g.is_retrograde ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                RETROGRADE
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">DIRECT</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Major Sign Ingress Events Timeline */}
              {transitViewMode === 'timeline_events' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Chronological list of planetary sign entries throughout the requested timeline:
                    </span>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter planet or sign..."
                        value={transitSearch}
                        onChange={e => setTransitSearch(e.target.value)}
                        className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Graha</th>
                          <th className="py-2.5 px-3">Transit Rashi</th>
                          <th className="py-2.5 px-3">Start Date</th>
                          <th className="py-2.5 px-3">End Date</th>
                          <th className="py-2.5 px-3 text-center">From Lagna</th>
                          <th className="py-2.5 px-3 text-center">From Rashi</th>
                          <th className="py-2.5 px-3">Star Occupied</th>
                          <th className="py-2.5 px-3">Summary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {apiResponse.transit_ephemeris_timeline.major_transits_timeline
                          .filter(
                            ev =>
                              !transitSearch.trim() ||
                              ev.graha_name.toLowerCase().includes(transitSearch.toLowerCase()) ||
                              ev.transit_rashi_name.toLowerCase().includes(transitSearch.toLowerCase()) ||
                              ev.start_date.includes(transitSearch)
                          )
                          .map((ev, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="py-2 px-3 font-bold text-white">{ev.graha_name}</td>
                              <td className="py-2 px-3 font-semibold text-amber-300">{ev.transit_rashi_name}</td>
                              <td className="py-2 px-3 font-mono text-cyan-400">{ev.start_date}</td>
                              <td className="py-2 px-3 font-mono text-rose-400">{ev.end_date}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded text-[11px]">
                                  House {ev.house_from_natal_lagna}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[11px]">
                                  House {ev.house_from_natal_rashi}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                {ev.nakshatra_name} (Pada {ev.pada})
                              </td>
                              <td className="py-2 px-3 text-slate-400 text-[11px] font-mono">
                                {ev.summary_text}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB: OPTION B HIGH-DENSITY LLM MARKDOWN (ZERO PII) */}
          {activeSubTab === 'markdown' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Option B: High-Density LLM Markdown Prompt (Strict Zero-PII)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Anonymized astrological context matrix engineered specifically for Gemini Pro, Claude 3.5, and GPT-4o reasoning.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setMarkdownView('preview')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        markdownView === 'preview' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Formatted View
                    </button>
                    <button
                      onClick={() => setMarkdownView('raw')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        markdownView === 'raw' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Raw Prompt Code
                    </button>
                  </div>

                  <button
                    onClick={() => copyToClipboard(llmMarkdownString, 'llm_md')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied === 'llm_md' ? 'Copied LLM Prompt!' : 'Copy Clean LLM Prompt'}
                  </button>

                  <button
                    onClick={() =>
                      downloadFile(
                        `${apiResponse.person_id}_llm_prompt.md`,
                        llmMarkdownString,
                        'text/markdown'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    Download .md
                  </button>
                </div>
              </div>

              {/* Badges / Metrics Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">PII Sanitization</div>
                    <div className="text-xs font-bold text-emerald-400">100% Stripped &amp; Anonymous</div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Prompt Footprint</div>
                    <div className="text-xs font-bold text-amber-300">~{llmTokenEst.toLocaleString()} tokens</div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Prompt Space Saved</div>
                    <div className="text-xs font-bold text-cyan-300">
                      {Math.max(0, Math.round((1 - llmTokenEst / (jsonTokenEst || 1)) * 100))}% reduction vs JSON
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Gochara (Transit)</div>
                    <div className="text-xs font-bold text-purple-300">Dual Houses (H_L &amp; H_M)</div>
                  </div>
                </div>
              </div>

              {/* Zero-PII Guarantee Notice */}
              <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-slate-200">Zero-PII Sanitization Guarantee:</strong> Human personal names, age, birth date, birth place, and Tamil prose are permanently excluded from this payload. The LLM only receives astrological coordinates (Lagna, Moon, planetary degrees, D1/D9 matrices, sequential PD sub-periods, and transit house activations).
                </div>
              </div>

              {/* Content Body */}
              {markdownView === 'raw' ? (
                <pre className="bg-slate-950 text-cyan-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-[550px] leading-relaxed select-all">
                  <code>{llmMarkdownString}</code>
                </pre>
              ) : (
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 text-xs text-slate-200 max-h-[550px] overflow-y-auto space-y-4 font-mono leading-relaxed select-all">
                  <pre className="whitespace-pre-wrap font-mono text-slate-300 text-xs leading-relaxed">
                    {llmMarkdownString}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'json' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    Standardized REST API JSON Response Structure
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Includes unique response tag, 1..100 sequence, person profile, D1/D9 placements, and all PD intervals.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(jsonString, 'raw_json')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    {copied === 'raw_json' ? 'Copied!' : 'Copy JSON'}
                  </button>
                  <button
                    onClick={() =>
                      downloadFile(
                        `${apiResponse.unique_response_id}.json`,
                        jsonString,
                        'application/json'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 text-cyan-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-[550px] leading-relaxed">
                <code>{jsonString}</code>
              </pre>
            </div>
          )}

          {/* SUB-TAB 4: CLIENT CALL SNIPPETS */}
          {activeSubTab === 'clients' && (
            <div className="space-y-4">
              {/* How to run API server */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Step 1: Start the REST API Server (Model 2)
                </div>
                <p className="text-xs text-slate-300">
                  Run the dedicated REST API script in your terminal. It reads settings from <code className="text-amber-400">config.ini</code>:
                </p>
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-amber-400">
                  <code>python run_api_server.py</code>
                  <button
                    onClick={() => copyToClipboard('python run_api_server.py', 'cmd_api')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copied === 'cmd_api' ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Option B: LLM Markdown Request (Zero PII) */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-white">
                      Option B: Direct LLM Prompt Call (format=llm_markdown, Zero PII)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      PII Stripped
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(curlMarkdownCommand, 'curl_md')}
                      className="inline-flex items-center gap-1 text-xs text-slate-200 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                    >
                      <Copy className="w-3 h-3 text-cyan-400" />
                      {copied === 'curl_md' ? 'Copied cURL!' : 'Copy cURL'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(pythonMarkdownClientCode, 'py_md')}
                      className="inline-flex items-center gap-1 text-xs text-slate-200 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                    >
                      <Copy className="w-3 h-3 text-emerald-400" />
                      {copied === 'py_md' ? 'Copied Python!' : 'Copy Python'}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Call the API with <code className="text-amber-300 font-mono">format=llm_markdown</code>. The server automatically excludes all personal identifiers (name, age, DOB, POB, Tamil text) and returns a concise, token-compressed Markdown document with 100% of astrological coordinates ready for Gemini or Claude.
                </p>

                <pre className="bg-slate-950 text-cyan-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{curlMarkdownCommand}</code>
                </pre>
              </div>

              {/* cURL Example (Default Full JSON) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    Default Full JSON Response (cURL Command)
                  </div>
                  <button
                    onClick={() => copyToClipboard(curlCommand, 'curl')}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                  >
                    <Copy className="w-3 h-3 text-amber-400" />
                    {copied === 'curl' ? 'Copied!' : 'Copy cURL'}
                  </button>
                </div>
                <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{curlCommand}</code>
                </pre>
              </div>

              {/* Python requests Example (Option B vs Full) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    Python Client Example (Option B: LLM Markdown Prompt Injection)
                  </div>
                  <button
                    onClick={() => copyToClipboard(pythonMarkdownClientCode, 'py_client')}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                  >
                    <Copy className="w-3 h-3 text-amber-400" />
                    {copied === 'py_client' ? 'Copied!' : 'Copy Python'}
                  </button>
                </div>
                <pre className="bg-slate-950 text-emerald-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{pythonMarkdownClientCode}</code>
                </pre>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: TRANSACTION AUDIT LOG (user_queries) */}
          {activeSubTab === 'audit' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    Transaction Audit Table: `user_queries`
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Stores the generated JSON response, requested time period, and cycling 1..100 running number for every API call.
                  </p>
                </div>
                <span className="text-xs font-mono bg-purple-500/10 text-purple-300 px-2.5 py-1 rounded border border-purple-500/20">
                  Cycling Sequence: user_query_seq (1..100)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Unique Query ID</th>
                      <th className="py-2.5 px-3 text-center">Running #</th>
                      <th className="py-2.5 px-3">Person ID</th>
                      <th className="py-2.5 px-3">Start Date</th>
                      <th className="py-2.5 px-3">End Date</th>
                      <th className="py-2.5 px-3">Created Timestamp</th>
                      <th className="py-2.5 px-3 text-center">Payload Saved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {queryHistory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                          {item.query_id}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                            #{item.running_number}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{item.person_id}</td>
                        <td className="py-2.5 px-3 font-mono text-cyan-400">{item.start_date}</td>
                        <td className="py-2.5 px-3 font-mono text-rose-400">{item.end_date}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            JSONB Stored
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
