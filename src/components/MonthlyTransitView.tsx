import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Sparkles,
  Eye,
  Layers,
  Compass,
  Info,
  X,
  Target,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar as CalendarIcon,
  Clock,
  Zap,
  Sliders,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import { samplePersonMaster, sampleNatalPlacements } from '../data/horoscopeData';
import { getGrahaTransitPosition, RASHI_LIST_META } from '../data/transitEphemeris';
import { getVimshottariDashaForDate, DynamicDashaHierarchy } from '../data/dashaCalculator';
import { AstroRule, DEFAULT_RULES, evaluateHouseActivations, HouseActivationResult } from '../data/ruleEngine';

/**
 * Maps a Planet / Lord to its traditional sign indices (1 = Aries .. 12 = Pisces)
 */
export function getLordOwnedSigns(lordName: string): number[] {
  const norm = lordName.toLowerCase();
  if (norm.includes('sun') || norm.includes('surya')) return [5]; // Leo
  if (norm.includes('moon') || norm.includes('chandra')) return [4]; // Cancer
  if (norm.includes('mars') || norm.includes('sevvai')) return [1, 8]; // Aries, Scorpio
  if (norm.includes('mercury') || norm.includes('budha')) return [3, 6]; // Gemini, Virgo
  if (norm.includes('jupiter') || norm.includes('guru')) return [9, 12]; // Sagittarius, Pisces
  if (norm.includes('venus') || norm.includes('sukra')) return [2, 7]; // Taurus, Libra
  if (norm.includes('saturn') || norm.includes('sani')) return [10, 11]; // Capricorn, Aquarius
  if (norm.includes('rahu')) return [11]; // Co-rules Aquarius
  if (norm.includes('ketu')) return [8]; // Co-rules Scorpio
  return [];
}

/**
 * 12 Signs Metadata with Fixed South Indian Grid Coordinates & Zodiac Iconography
 */
export interface ZodiacSignMeta {
  index: number; // 1 = Aries .. 12 = Pisces
  eng: string;
  tamil: string;
  lord: string;
  r: number; // Row in 4x4 grid (0..3)
  c: number; // Col in 4x4 grid (0..3)
  icon: string; // Astrological Archetype Emoji/Icon
  symbol: string; // Astronomical Symbol
}

export const SOUTH_INDIAN_SIGNS: ZodiacSignMeta[] = [
  // Row 0 (Top)
  { index: 12, eng: 'Meenam (Pisces)', tamil: 'மீனம்', lord: 'Jupiter (Guru)', r: 0, c: 0, icon: '🐟', symbol: '♓' },
  { index: 1, eng: 'Mesham (Aries)', tamil: 'மேஷம்', lord: 'Mars (Sevvai)', r: 0, c: 1, icon: '🐏', symbol: '♈' },
  { index: 2, eng: 'Rishabam (Taurus)', tamil: 'ரிஷபம்', lord: 'Venus (Sukra)', r: 0, c: 2, icon: '🐂', symbol: '♉' },
  { index: 3, eng: 'Mithunam (Gemini)', tamil: 'மிதுனம்', lord: 'Mercury (Budha)', r: 0, c: 3, icon: '👥', symbol: '♊' },

  // Row 1
  { index: 11, eng: 'Kumbam (Aquarius)', tamil: 'கும்பம்', lord: 'Saturn (Sani)', r: 1, c: 0, icon: '🏺', symbol: '♒' },
  { index: 4, eng: 'Katakam (Cancer)', tamil: 'கடகம்', lord: 'Moon (Chandra)', r: 1, c: 3, icon: '🦀', symbol: '♋' },

  // Row 2
  { index: 10, eng: 'Makaram (Capricorn)', tamil: 'மகரம்', lord: 'Saturn (Sani)', r: 2, c: 0, icon: '🐐', symbol: '♑' },
  { index: 5, eng: 'Simham (Leo)', tamil: 'சிம்மம்', lord: 'Sun (Surya)', r: 2, c: 3, icon: '🦁', symbol: '♌' },

  // Row 3 (Bottom)
  { index: 9, eng: 'Dhanus (Sagittarius)', tamil: 'தனுசு', lord: 'Jupiter (Guru)', r: 3, c: 0, icon: '🏹', symbol: '♐' },
  { index: 8, eng: 'Vrischigam (Scorpio)', tamil: 'விருச்சிகம்', lord: 'Mars (Sevvai)', r: 3, c: 1, icon: '🦂', symbol: '♏' },
  { index: 7, eng: 'Thulaam (Libra)', tamil: 'துலாம்', lord: 'Venus (Sukra)', r: 3, c: 2, icon: '⚖️', symbol: '♎' },
  { index: 6, eng: 'Kanni (Virgo)', tamil: 'கன்னி', lord: 'Mercury (Budha)', r: 3, c: 3, icon: '🌾', symbol: '♍' },
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Standard Vedic Planet Symbols & Short Codes
 */
export const PLANET_ICONS: Record<string, { symbol: string; short: string; color: string }> = {
  Sun: { symbol: '☉', short: 'Su', color: 'text-amber-400' },
  Moon: { symbol: '☽', short: 'Mo', color: 'text-sky-300' },
  Mars: { symbol: '♂', short: 'Ma', color: 'text-rose-400' },
  Mercury: { symbol: '☿', short: 'Me', color: 'text-emerald-400' },
  Jupiter: { symbol: '♃', short: 'Ju', color: 'text-yellow-300' },
  Venus: { symbol: '♀', short: 'Ve', color: 'text-pink-300' },
  Saturn: { symbol: '♄', short: 'Sa', color: 'text-indigo-400' },
  Rahu: { symbol: '☊', short: 'Ra', color: 'text-purple-400' },
  Ketu: { symbol: '☋', short: 'Ke', color: 'text-violet-400' },
  Lagna: { symbol: 'Asc', short: 'Lag', color: 'text-cyan-300' },
};

/**
 * Classical Vedic Graha Drishti (Aspect Rules)
 */
export function calculateGrahaDrishti(
  sourceSignIndex: number,
  planetKey: string
): { targetSignIndex: number; aspectType: string; aspectDegree: number }[] {
  const aspects: { targetSignIndex: number; aspectType: string; aspectDegree: number }[] = [];

  const addAspect = (houseOffset: number, label: string) => {
    const targetIdx = ((sourceSignIndex - 1 + (houseOffset - 1)) % 12) + 1;
    aspects.push({
      targetSignIndex: targetIdx,
      aspectType: label,
      aspectDegree: houseOffset === 1 ? 0 : (houseOffset - 1) * 30
    });
  };

  // Base 1st house (self-occupation)
  addAspect(1, 'Occupation (1st)');

  // All Grahas have 7th house full aspect
  addAspect(7, 'Full 7th Drishti');

  const p = planetKey.toLowerCase();
  if (p.includes('saturn') || p.includes('sani') || p.includes('sa')) {
    addAspect(3, 'Special 3rd Drishti');
    addAspect(10, 'Special 10th Drishti');
  } else if (p.includes('mars') || p.includes('sevvai') || p.includes('ma')) {
    addAspect(4, 'Special 4th Drishti');
    addAspect(8, 'Special 8th Drishti');
  } else if (p.includes('jupiter') || p.includes('guru') || p.includes('ju')) {
    addAspect(5, 'Special 5th Drishti');
    addAspect(9, 'Special 9th Drishti');
  } else if (p.includes('rahu') || p.includes('ketu') || p.includes('ra') || p.includes('ke')) {
    addAspect(5, 'Trine 5th Drishti');
    addAspect(9, 'Trine 9th Drishti');
  }

  return aspects;
}

export interface MonthlyTransitViewProps {
  personId?: string;
}

export const MonthlyTransitView: React.FC<MonthlyTransitViewProps> = ({ personId = '001ME' }) => {
  // Current real-world date reference
  const realNow = useMemo(() => new Date(), []);

  // Selected Year & Month state (Defaults to current month)
  const [selectedYear, setSelectedYear] = useState<number>(realNow.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(realNow.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<number>(15); // Mid-month reference for ephemeris

  // Active selected planet for Raycasting
  const [activeRaycast, setActiveRaycast] = useState<{
    id: string;
    name: string;
    sourceSignIndex: number;
    sourceSignName: string;
    layer: 'natal' | 'transit';
    aspectTargets: { targetSignIndex: number; aspectType: string; aspectDegree: number }[];
  } | null>(null);

  // Natal Lagna Sign Index (001ME = Dhanus / Sagittarius = 9)
  const natalLagnaIdx = 9;
  const natalRashiIdx = 8; // Vrischigam / Scorpio

  // D1 Natal Placements
  const natalD1Placements = useMemo(() => {
    return sampleNatalPlacements.filter(p => p.chart_type === 'D1');
  }, []);

  // Active Evaluation Date object
  const activeDate = useMemo(() => {
    return new Date(Date.UTC(selectedYear, selectedMonth, selectedDay, 12, 0, 0));
  }, [selectedYear, selectedMonth, selectedDay]);

  const activeDateIsoStr = useMemo(() => {
    return activeDate.toISOString().slice(0, 10);
  }, [activeDate]);

  // Compute Active Month Transits (Gochara) using astronomical ephemeris
  const transitPlacements = useMemo(() => {
    const grahaKeys = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    return grahaKeys.map(k => getGrahaTransitPosition(k, activeDate, natalLagnaIdx, natalRashiIdx));
  }, [activeDate, natalLagnaIdx, natalRashiIdx]);

  // Resolve Active Vimshottari Dasha Hierarchy for Selected Date dynamically
  const activeDashaHierarchy = useMemo(() => {
    return getVimshottariDashaForDate(activeDateIsoStr);
  }, [activeDateIsoStr]);

  // Houses ruled or occupied by the active PD Lord
  const pdLordOwnedSigns = useMemo(() => {
    return getLordOwnedSigns(activeDashaHierarchy.pratyantardasha);
  }, [activeDashaHierarchy.pratyantardasha]);

  // Astrological Rule Engine configuration state
  const [rules, setRules] = useState<AstroRule[]>(DEFAULT_RULES);
  const [showRuleConfig, setShowRuleConfig] = useState<boolean>(true);

  // Compute House Activation Scores across the 12 houses
  const houseActivations = useMemo(() => {
    const transitWithAspects = transitPlacements.map(tp => ({
      graha_key: tp.graha_key,
      transit_rashi_index: tp.transit_rashi_index,
      aspect_targets: calculateGrahaDrishti(tp.transit_rashi_index, tp.graha_key).map(a => a.targetSignIndex)
    }));

    const natalSimple = natalD1Placements.map(np => {
      const signMeta = SOUTH_INDIAN_SIGNS.find(s => {
        const norm = np.rashi_name.toLowerCase();
        return s.eng.toLowerCase().includes(norm) || norm.includes(s.tamil);
      });
      return {
        body_name: np.body_name,
        rashi_index: signMeta ? signMeta.index : 9
      };
    });

    return evaluateHouseActivations(rules, {
      natalLagnaIdx,
      natalRashiIdx,
      activePdLord: activeDashaHierarchy.pratyantardasha,
      activeAdLord: activeDashaHierarchy.antardasha,
      activeMdLord: activeDashaHierarchy.mahadasha,
      pdLordOwnedSigns,
      transitPlanets: transitWithAspects,
      natalPlanets: natalSimple
    });
  }, [rules, transitPlacements, natalD1Placements, activeDashaHierarchy, pdLordOwnedSigns]);

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isEnabled: !r.isEnabled } : r));
  };

  const handleWeightChange = (ruleId: string, newWeight: number) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, weight: newWeight } : r));
  };

  const handleResetRules = () => {
    setRules(DEFAULT_RULES);
  };

  // Timeline Navigation Handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(prev => prev - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(prev => prev + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handlePrevYear = () => setSelectedYear(prev => prev - 1);
  const handleNextYear = () => setSelectedYear(prev => prev + 1);
  const handleResetToCurrent = () => {
    setSelectedYear(realNow.getFullYear());
    setSelectedMonth(realNow.getMonth());
    setSelectedDay(15);
  };

  // Determine Timeline Era badge
  const isCurrentMonth = selectedYear === realNow.getFullYear() && selectedMonth === realNow.getMonth();
  const isPast = selectedYear < realNow.getFullYear() || (selectedYear === realNow.getFullYear() && selectedMonth < realNow.getMonth());

  // Handle clicking a planet to trigger aspect raycasting
  const handlePlanetClick = (
    e: React.MouseEvent,
    planetName: string,
    signIndex: number,
    signName: string,
    layer: 'natal' | 'transit'
  ) => {
    e.stopPropagation();
    const planetId = `${layer}-${planetName}-${signIndex}`;

    if (activeRaycast && activeRaycast.id === planetId) {
      setActiveRaycast(null);
      return;
    }

    const aspects = calculateGrahaDrishti(signIndex, planetName);
    setActiveRaycast({
      id: planetId,
      name: planetName,
      sourceSignIndex: signIndex,
      sourceSignName: signName,
      layer,
      aspectTargets: aspects
    });
  };

  // Find aspect information for a given sign index
  const getAspectInfoForSign = (signIndex: number) => {
    if (!activeRaycast) return null;
    return activeRaycast.aspectTargets.find(a => a.targetSignIndex === signIndex);
  };

  // Generate Year options from 1976 (birth) to 2070
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 1976; y <= 2065; y++) {
      years.push(y);
    }
    return years;
  }, []);

  return (
    <div className="space-y-5" onClick={() => setActiveRaycast(null)}>
      {/* ========================================================================= */}
      {/* TIMELINE CONTROLLER & BI-DIRECTIONAL DATE SCRUBBER (MILESTONE 2) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
          {/* Header Title & Era Indicator */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Monthly Transit & Ephemeris Backtesting Engine
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    isCurrentMonth
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : isPast
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  }`}
                >
                  {isCurrentMonth ? '● Current Active Month' : isPast ? '⏪ Historical Backtest' : '⏩ Future Projection'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Navigate any 30-day window backward to 1976 or forward to 2065 to evaluate historical events and future Gochara activations.
              </p>
            </div>
          </div>

          {/* Quick Jump to Today Button */}
          <div className="flex items-center gap-2">
            {!isCurrentMonth && (
              <button
                onClick={handleResetToCurrent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 transition shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Jump to Current Month
              </button>
            )}
            <div className="text-right text-[11px] font-mono text-slate-400 hidden sm:block">
              Ephemeris Date: <span className="text-amber-400 font-bold">{activeDateIsoStr}</span>
            </div>
          </div>
        </div>

        {/* Date Scrubber & Year/Month Selectors */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Month / Year Navigator Buttons */}
          <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
            {/* -1 Year */}
            <button
              onClick={handlePrevYear}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/80 flex items-center gap-1"
              title="Previous Year (-1 Yr)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>-1 Yr</span>
            </button>

            {/* -1 Month */}
            <button
              onClick={handlePrevMonth}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/80 flex items-center gap-1"
              title="Previous Month (-1 Mo)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            {/* Month Dropdown */}
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {/* +1 Month */}
            <button
              onClick={handleNextMonth}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/80 flex items-center gap-1"
              title="Next Month (+1 Mo)"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* +1 Year */}
            <button
              onClick={handleNextYear}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/80 flex items-center gap-1"
              title="Next Year (+1 Yr)"
            >
              <span>+1 Yr</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Real-Time Vimshottari Dasha Hierarchy Card */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-inner">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Active Dasha Period
              </span>
              <span className="font-mono text-[10px] text-amber-400/90 font-bold">
                {activeDashaHierarchy.startDate} &rarr; {activeDashaHierarchy.endDate} ({activeDashaHierarchy.totalDays}d)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Maha Dasha */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Maha Dasha</span>
                <span className="text-xs font-bold text-amber-300 truncate block">
                  {activeDashaHierarchy.mahadasha.split(' ')[0]}
                </span>
              </div>

              {/* Antar Dasha */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Antar Dasha</span>
                <span className="text-xs font-bold text-sky-300 truncate block">
                  {activeDashaHierarchy.antardasha.split(' ')[0]}
                </span>
              </div>

              {/* Pratyantar Dasha */}
              <div className="bg-slate-900/90 border border-amber-500/50 rounded-lg p-1.5 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30">
                <span className="text-[10px] uppercase font-bold text-amber-400 block flex items-center justify-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                  PD Lord
                </span>
                <span className="text-xs font-extrabold text-amber-200 truncate block">
                  {activeDashaHierarchy.pratyantardasha.split(' ')[0]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Month Key Planetary Transits Strip */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gochara Coordinates ({MONTH_NAMES[selectedMonth]} {selectedYear}):</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {['Saturn', 'Jupiter', 'Mars', 'Rahu'].map(gKey => {
              const tp = transitPlacements.find(p => p.graha_key === gKey);
              if (!tp) return null;
              return (
                <span
                  key={gKey}
                  className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1 font-mono text-[10px]"
                >
                  <strong className={gKey === 'Saturn' ? 'text-indigo-400' : gKey === 'Jupiter' ? 'text-yellow-400' : 'text-rose-400'}>
                    {gKey}:
                  </strong>
                  <span>{tp.transit_rashi_tamil} ({tp.transit_rashi_name.split(' ')[0]})</span>
                  <span className="text-amber-400/90">{tp.degree_sputa.split(' ')[0]}</span>
                  {tp.is_retrograde && <span className="text-rose-400 font-bold">(R)</span>}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Graha Drishti Raycasting Status Bar */}
      {activeRaycast ? (
        <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 rounded-xl p-3.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-purple-500/5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
            </span>
            <div>
              <span className="font-bold text-white text-sm">
                Graha Drishti Active: {activeRaycast.layer === 'natal' ? 'Natal' : 'Transit'} {activeRaycast.name}
              </span>
              <span className="text-slate-300 ml-2">
                in {activeRaycast.sourceSignName} &rarr; illuminating {activeRaycast.aspectTargets.length} target houses
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeRaycast.aspectTargets.map(tgt => {
                const sDef = SOUTH_INDIAN_SIGNS.find(s => s.index === tgt.targetSignIndex);
                const hNum = ((tgt.targetSignIndex - natalLagnaIdx + 12) % 12) + 1;
                return (
                  <span
                    key={tgt.targetSignIndex}
                    className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200 font-mono text-[11px]"
                  >
                    H{hNum} ({sDef?.tamil} - {tgt.aspectType})
                  </span>
                );
              })}
            </div>
            <button
              onClick={() => setActiveRaycast(null)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Clear Drishti"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            Select any planet badge (e.g. <strong>Saturn</strong>, <strong>Jupiter</strong>, or <strong>Mars</strong>) to raycast and highlight its aspected houses (Graha Drishti).
          </span>
          <div className="flex items-center gap-2.5 text-[11px]">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Grey = Natal Birth (Fixed / Non-changeable)
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/40 text-amber-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Yellow [Tr] = Gochara Transit ({MONTH_NAMES[selectedMonth]} {selectedYear})
            </span>
          </div>
        </div>
      )}

      {/* FULL SCREEN 4x4 SOUTH INDIAN D1 GRID */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
        <div className="grid grid-cols-4 grid-rows-4 gap-2.5 sm:gap-3.5 aspect-square max-w-4xl mx-auto bg-slate-950 p-2.5 sm:p-3.5 rounded-2xl border border-slate-800 shadow-inner">
          {[0, 1, 2, 3].map(rowIdx =>
            [0, 1, 2, 3].map(colIdx => {
              // Center 2x2 hollow container
              if ((rowIdx === 1 || rowIdx === 2) && (colIdx === 1 || colIdx === 2)) {
                if (rowIdx === 1 && colIdx === 1) {
                  return (
                    <div
                      key={`center-${rowIdx}-${colIdx}`}
                      className="col-span-2 row-span-2 bg-slate-950/60 border border-slate-800/80 rounded-xl shadow-inner"
                    />
                  );
                }
                return null;
              }

              // Perimeter sign cell
              const signDef = SOUTH_INDIAN_SIGNS.find(s => s.r === rowIdx && s.c === colIdx);
              if (!signDef) return null;

              // Calculate relative house from birth Lagna (Dhanus = 9 => House 1)
              const houseNum = ((signDef.index - natalLagnaIdx + 12) % 12) + 1;
              const isLagnaHouse = houseNum === 1;

              // Find Natal Occupants in this sign
              const natalOccupants = natalD1Placements.filter(p => {
                const norm = p.rashi_name.toLowerCase();
                const signNorm = signDef.eng.toLowerCase();
                return signNorm.includes(norm) || norm.includes(signDef.tamil);
              });

              // Find Transit Occupants in this sign for selected month
              const currentTransitsInSign = transitPlacements.filter(
                tp => tp.transit_rashi_index === signDef.index
              );

              // Aspect Info for this cell if raycasting
              const aspectInfo = getAspectInfoForSign(signDef.index);
              const isAspectSource = activeRaycast?.sourceSignIndex === signDef.index;
              const isAspectedTarget = !!aspectInfo && !isAspectSource;

              // PD Lord Activation (Rulership or Occupation)
              const isPdLordRulership = pdLordOwnedSigns.includes(signDef.index);
              const pdLordShort = activeDashaHierarchy.pratyantardasha.split(' ')[0].toLowerCase();
              const isPdLordOccupied =
                natalOccupants.some(p => p.body_name.toLowerCase().includes(pdLordShort)) ||
                currentTransitsInSign.some(p => p.graha_key.toLowerCase().includes(pdLordShort));
              const isPdLordFocus = isPdLordRulership || isPdLordOccupied;

              // Event Activation Result for this house
              const houseActivation = houseActivations.find(ha => ha.signIndex === signDef.index);
              const isEventEmitting = !!houseActivation?.isEventActive;

              return (
                <div
                  key={`cell-${rowIdx}-${colIdx}`}
                  className={`relative rounded-xl p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-300 border ${
                    isAspectedTarget
                      ? 'border-purple-500/80 bg-purple-950/30 ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/10'
                      : isAspectSource
                      ? 'border-amber-400 bg-amber-950/20 ring-2 ring-amber-400/40'
                      : isEventEmitting
                      ? 'border-amber-400 bg-gradient-to-br from-amber-950/40 to-slate-900/90 ring-2 ring-amber-400/80 shadow-xl shadow-amber-500/20 animate-pulse'
                      : isPdLordFocus
                      ? 'border-amber-500/70 bg-amber-950/20 ring-1 ring-amber-400/40 shadow-md shadow-amber-500/10'
                      : isLagnaHouse
                      ? 'border-cyan-500/60 bg-cyan-950/25 ring-1 ring-cyan-500/30'
                      : 'border-slate-800/90 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  {/* CELL HEADER: Zodiac Symbol, Icon, Tamil Name & Relative House */}
                  <div className="flex items-center justify-between gap-1 leading-none pb-1 border-b border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm select-none" title={signDef.eng}>
                        {signDef.icon}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[11px] sm:text-xs font-bold text-slate-200">
                          {signDef.tamil}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono hidden sm:inline">
                          {signDef.eng.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isLagnaHouse && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Lagna
                        </span>
                      )}
                      {isEventEmitting && (
                        <span
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 shadow-sm flex items-center gap-0.5"
                          title={`Life Event Emitting House (Score: ${houseActivation?.totalScore})\n${houseActivation?.matchedRules.map(r => `• ${r.ruleName}: ${r.reason}`).join('\n')}`}
                        >
                          <Sparkles className="w-2.5 h-2.5 text-slate-950" />
                          Event ({houseActivation?.totalScore})
                        </span>
                      )}
                      {!isEventEmitting && isPdLordFocus && (
                        <span
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5"
                          title={`Active PD Lord (${activeDashaHierarchy.pratyantardasha}) ${isPdLordRulership ? 'Rulership House' : 'Occupation'}`}
                        >
                          <Zap className="w-2.5 h-2.5 text-amber-400" />
                          PD
                        </span>
                      )}
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          isLagnaHouse
                            ? 'bg-cyan-500 text-slate-950 font-extrabold'
                            : isAspectedTarget
                            ? 'bg-purple-500 text-white shadow-sm'
                            : isEventEmitting
                            ? 'bg-amber-400 text-slate-950 font-extrabold'
                            : isPdLordFocus
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                        title={`House ${houseNum} relative to Lagna (Activation Score: ${houseActivation?.totalScore || 0})`}
                      >
                        H{houseNum}
                      </span>
                    </div>
                  </div>

                  {/* Aspected Target Notification Badge */}
                  {isAspectedTarget && (
                    <div className="mt-1 px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/30 text-[9px] text-purple-200 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Target className="w-2.5 h-2.5 text-purple-300" />
                        {aspectInfo?.aspectType}
                      </span>
                    </div>
                  )}

                  {/* DUAL LAYER PLANETARY BADGES */}
                  <div className="my-auto py-1 space-y-1 overflow-y-auto max-h-[140px] pr-0.5">
                    {/* BASE LAYER: NATAL BIRTH PLANETS (GREYED OUT AS PERMANENT / UNCHANGEABLE, DRISHTI ENABLED) */}
                    {natalOccupants.map(natalP => {
                      const isSelected =
                        activeRaycast?.layer === 'natal' &&
                        activeRaycast?.name === natalP.body_name &&
                        activeRaycast?.sourceSignIndex === signDef.index;

                      return (
                        <button
                          key={`natal-${natalP.body_name}`}
                          onClick={e =>
                            handlePlanetClick(e, natalP.body_name, signDef.index, signDef.eng, 'natal')
                          }
                          className={`w-full text-left text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded flex items-center justify-between transition group ${
                            isSelected
                              ? 'bg-slate-200 text-slate-950 font-bold ring-2 ring-slate-100 shadow-md'
                              : natalP.body_name === 'Lagna'
                              ? 'bg-slate-800 text-slate-200 border border-slate-600/90 hover:bg-slate-700 hover:text-white'
                              : 'bg-slate-800/70 text-slate-300 border border-slate-700/70 hover:bg-slate-700/60 hover:text-white hover:border-slate-500'
                          }`}
                          title={`Natal ${natalP.body_name} in ${signDef.eng} (Fixed Birth Placement - Click to raycast Graha Drishti)`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span className="text-[10px] text-slate-400 group-hover:text-slate-200">●</span>
                            <span className="truncate">{natalP.body_name}</span>
                          </span>
                          <span className="text-[9px] opacity-75 font-mono ml-1 text-slate-400">
                            {natalP.is_retrograde && (
                              <span className="text-rose-400 mr-1" title="Retrograde">
                                (R)
                              </span>
                            )}
                            {natalP.degree_sputa ? natalP.degree_sputa.split(' ')[0] : ''}
                          </span>
                        </button>
                      );
                    })}

                    {/* OVERLAY LAYER: TRANSITING PLANETS (GOCHARA) - COLOR CODED IN YELLOW */}
                    {currentTransitsInSign.map(transitP => {
                      const isSelected =
                        activeRaycast?.layer === 'transit' &&
                        activeRaycast?.name === transitP.graha_key &&
                        activeRaycast?.sourceSignIndex === signDef.index;

                      return (
                        <button
                          key={`transit-${transitP.graha_key}`}
                          onClick={e =>
                            handlePlanetClick(e, transitP.graha_key, signDef.index, signDef.eng, 'transit')
                          }
                          className={`w-full text-left text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center justify-between transition ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 font-extrabold ring-2 ring-amber-300 shadow-md'
                              : 'bg-amber-950/30 text-amber-300 border border-amber-500/40 hover:bg-amber-900/40 hover:border-amber-400'
                          }`}
                          title={`[Tr] Transit ${transitP.graha_name} at ${transitP.degree_sputa} (Click to raycast Graha Drishti)`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span className="text-[9px] px-1 rounded bg-amber-500/25 text-amber-300 font-mono font-bold">
                              Tr
                            </span>
                            <span className="truncate">{transitP.graha_key}</span>
                          </span>
                          <span className="text-[9px] font-mono text-amber-300/90 ml-1">
                            {transitP.is_retrograde && (
                              <span className="text-rose-400 mr-1" title="Retrograde (வக்ரம்)">
                                (R)
                              </span>
                            )}
                            {transitP.degree_sputa}
                          </span>
                        </button>
                      );
                    })}

                    {/* Empty cell indicator */}
                    {natalOccupants.length === 0 && currentTransitsInSign.length === 0 && (
                      <div className="text-[10px] text-slate-600 italic text-center py-2">
                        No Grahas
                      </div>
                    )}
                  </div>

                  {/* CELL FOOTER: Rashi Lord */}
                  <div className="pt-1 border-t border-slate-800/40 flex items-center justify-between text-[9px] text-slate-400">
                    <span className="truncate">Lord: {signDef.lord.split(' ')[0]}</span>
                    <span className="text-slate-500">{signDef.symbol}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PERSISTED ASTROLOGICAL RULE ENGINE CONFIGURATOR (MILESTONE 3) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Astrological Rule Engine & Event Emission Weights
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Milestone 3 Live
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Declarative Vedic rules scoring monthly house activation. Houses reaching score &ge; 0.55 pulse with life-event indicators.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetRules}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Reset weights and toggles to standard defaults"
            >
              Reset to Defaults
            </button>
            <button
              onClick={() => setShowRuleConfig(!showRuleConfig)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 transition shadow-sm"
            >
              {showRuleConfig ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Hide Rules</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Configure Rules</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Activated Houses Summary Pill Strip */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-semibold text-slate-200">
              Active Event Houses for {MONTH_NAMES[selectedMonth]} {selectedYear}:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {houseActivations.filter(h => h.isEventActive).length > 0 ? (
              houseActivations
                .filter(h => h.isEventActive)
                .map(act => {
                  const sDef = SOUTH_INDIAN_SIGNS.find(s => s.index === act.signIndex);
                  return (
                    <span
                      key={act.signIndex}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>House {act.houseNumber} ({sDef?.tamil} - {sDef?.eng.split(' ')[0]})</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px]">
                        {act.totalScore}
                      </span>
                    </span>
                  );
                })
            ) : (
              <span className="text-slate-400 italic text-[11px]">
                No houses currently reach the &ge; 0.55 activation threshold. Increase weights below to test sensitive triggers.
              </span>
            )}
          </div>
        </div>

        {/* Expandable Rules Grid */}
        {showRuleConfig && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`p-3.5 rounded-xl border transition ${
                  rule.isEnabled
                    ? 'bg-slate-950 border-slate-800'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{rule.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-400">
                        {rule.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {rule.description}
                    </p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      rule.isEnabled ? 'bg-amber-500' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                        rule.isEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Weight Slider */}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-slate-400 text-[11px]">Influence Weight:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={!rule.isEnabled}
                    value={rule.weight}
                    onChange={e => handleWeightChange(rule.id, parseFloat(e.target.value))}
                    className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-xs font-bold text-amber-400 w-10 text-right">
                    {rule.weight.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

