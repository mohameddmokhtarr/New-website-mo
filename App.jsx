import { useState, useEffect, useRef } from "react";

// ─── Storage (localStorage) ───────────────────────────────────────────────────

const STORAGE_KEY = "daily-tracker-data-v2";
const META_KEY = "daily-tracker-meta";

function storageGet(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatMonthYear(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function getMonthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Commitments ──────────────────────────────────────────────────────────────

function getDayCommitments(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const contentStarted = dateStr >= "2025-03-30";
  const c = [];

  if (day === 1) c.push({ id: "train", text: "BJJ training", category: "body" });
  else if (day === 2) c.push({ id: "train", text: "Boxing training", category: "body" });
  else if (day === 3 || day === 5 || day === 6) c.push({ id: "train", text: "Gym session", category: "body" });

  c.push({ id: "job", text: "9-5 — did I work the plan today?", category: "build" });
  c.push({ id: "outreach", text: "25 DMs sent (outreach)", category: "build" });

  if (contentStarted) c.push({ id: "content", text: "Content work (film / edit / post)", category: "build" });

  c.push({ id: "diet", text: "Hit full diet today (~2,900 kcal)", category: "body" });
  c.push({ id: "honesty", text: "No new lies — not even small ones", category: "self" });

  return c;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function getStreak(history, graceDays = 0) {
  const keys = Object.keys(history).sort().reverse();
  let streak = 0;
  let gracesUsed = 0;
  for (const key of keys) {
    const commitments = getDayCommitments(key);
    const checks = history[key]?.checks || {};
    const done = commitments.filter(c => !!checks[c.id]).length;
    if (done === commitments.length) {
      streak++;
    } else if (gracesUsed < graceDays) {
      gracesUsed++;
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getCategoryStats(data, dateKeys) {
  const cats = {
    body: { done: 0, total: 0 },
    build: { done: 0, total: 0 },
    self: { done: 0, total: 0 },
  };
  for (const key of dateKeys) {
    const commitments = getDayCommitments(key);
    const checks = data[key]?.checks || {};
    for (const c of commitments) {
      cats[c.category].total++;
      if (checks[c.id]) cats[c.category].done++;
    }
  }
  return cats;
}

function getWeekStats(data, weekStartStr) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartStr, i));
  let perfect = 0, partial = 0, missed = 0, totalDone = 0, totalPossible = 0;
  for (const key of days) {
    const commitments = getDayCommitments(key);
    const checks = data[key]?.checks || {};
    const done = commitments.filter(c => !!checks[c.id]).length;
    totalDone += done;
    totalPossible += commitments.length;
    if (done === commitments.length) perfect++;
    else if (done > 0) partial++;
    else missed++;
  }
  return { perfect, partial, missed, totalDone, totalPossible, days };
}

function getMonthStats(data, monthKey) {
  const keys = Object.keys(data).filter(k => k.startsWith(monthKey));
  let perfect = 0, partial = 0, missed = 0, totalDone = 0, totalPossible = 0;
  for (const key of keys) {
    const commitments = getDayCommitments(key);
    const checks = data[key]?.checks || {};
    const done = commitments.filter(c => !!checks[c.id]).length;
    totalDone += done;
    totalPossible += commitments.length;
    if (done === commitments.length) perfect++;
    else if (done > 0) partial++;
    else missed++;
  }
  return { perfect, partial, missed, totalDone, totalPossible, tracked: keys.length };
}

function bestCategory(catStats) {
  let best = null, bestPct = -1;
  for (const cat of ["body", "build", "self"]) {
    const s = catStats[cat];
    if (s.total === 0) continue;
    const pct = s.done / s.total;
    if (pct > bestPct) { bestPct = pct; best = cat; }
  }
  return best;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const categoryColors = { body: "#e8a87c", build: "#7cb9e8", self: "#a87ce8" };
const categoryLabels = { body: "BODY", build: "BUILD", self: "SELF" };
const DAY_LABELS = { 0: "REST DAY", 1: "BJJ DAY", 2: "BOXING DAY", 3: "GYM DAY", 4: "REST DAY", 5: "GYM DAY", 6: "GYM DAY" };
const STREAK_MILESTONES = [7, 14, 30, 60, 100];
const STREAK_MESSAGES = {
  7: "ONE WEEK STRAIGHT.",
  14: "TWO WEEKS.",
  30: "30 DAYS. YOU'RE BUILDING SOMETHING REAL.",
  60: "60 DAYS. MOST PEOPLE QUIT BY NOW.",
  100: "100 DAYS. YOU ARE NOT THE SAME PERSON.",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StreakCelebration({ streak, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.4s ease" }}>
      <div style={{ fontSize: "80px", animation: "scaleUp 0.5s ease", marginBottom: "16px" }}>🔥</div>
      <div style={{ fontSize: "48px", fontWeight: "bold", color: "#e8a87c", fontFamily: "monospace", animation: "scaleUp 0.6s ease" }}>{streak}</div>
      <div style={{ fontSize: "9px", letterSpacing: "0.4em", color: "#e8a87c", fontFamily: "monospace", marginBottom: "20px", textTransform: "uppercase" }}>DAY STREAK</div>
      <div style={{ fontSize: "13px", letterSpacing: "0.15em", color: "#888", fontFamily: "monospace", textAlign: "center", padding: "0 40px", animation: "pulse 2s infinite" }}>
        {STREAK_MESSAGES[streak] || `${streak} DAYS STRAIGHT.`}
      </div>
    </div>
  );
}

function CategoryBar({ label, done, total, color }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color }} />
          <div style={{ fontSize: "8px", letterSpacing: "0.3em", color: "#555", textTransform: "uppercase" }}>{label}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "8px", color: "#333", letterSpacing: "0.1em" }}>{done}/{total}</div>
          <div style={{ fontSize: "10px", fontWeight: "bold", color: pct >= 80 ? color : pct >= 50 ? "#888" : "#444", minWidth: "32px", textAlign: "right" }}>{pct}%</div>
        </div>
      </div>
      <div style={{ height: "2px", background: "#1a1a1a", borderRadius: "1px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, opacity: pct >= 80 ? 1 : 0.4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function ResetConfirm({ streak, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#111", border: "1px solid #2e2e2e", borderRadius: "4px", padding: "28px", maxWidth: "320px", width: "100%" }}>
        <div style={{ fontSize: "9px", letterSpacing: "0.35em", color: "#e8a87c", textTransform: "uppercase", marginBottom: "14px" }}>RESET STREAK</div>
        <div style={{ fontSize: "13px", color: "#888", lineHeight: 1.6, marginBottom: "24px" }}>
          Your current streak is <span style={{ color: "#e8a87c", fontWeight: "bold" }}>{streak}</span>. This will wipe all check history and reset to zero. Your notes stay.
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onConfirm} style={{ flex: 1, background: "#1a0a0a", border: "1px solid #3a1a1a", color: "#e87c7c", padding: "10px", fontSize: "8px", letterSpacing: "0.3em", textTransform: "uppercase", cursor: "pointer", fontFamily: "monospace", borderRadius: "2px" }}>RESET</button>
          <button onClick={onCancel} style={{ flex: 1, background: "none", border: "1px solid #222", color: "#555", padding: "10px", fontSize: "8px", letterSpacing: "0.3em", textTransform: "uppercase", cursor: "pointer", fontFamily: "monospace", borderRadius: "2px" }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function Settings({ meta, streak, onUpdateMeta, onResetRequest, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 998, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "4px 4px 0 0", padding: "28px", width: "100%", maxWidth: "600px", animation: "fadeIn 0.2s ease" }}>
        <div style={{ fontSize: "9px", letterSpacing: "0.4em", color: "#555", textTransform: "uppercase", marginBottom: "24px" }}>SETTINGS</div>

        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#888" }}>Grace days</div>
            <div style={{ fontSize: "11px", color: meta.graceDays > 0 ? "#e8a87c" : "#444" }}>
              {meta.graceDays === 0 ? "OFF" : `${meta.graceDays} day${meta.graceDays > 1 ? "s" : ""}`}
            </div>
          </div>
          <input
            type="range" min={0} max={3} value={meta.graceDays}
            onChange={e => onUpdateMeta({ ...meta, graceDays: Number(e.target.value) })}
            style={{ width: "100%", accentColor: "#e8a87c" }}
          />
          <div style={{ fontSize: "10px", color: "#333", marginTop: "6px", lineHeight: 1.5 }}>
            {meta.graceDays === 0
              ? "Streak breaks on any missed day. Hard mode."
              : `Miss up to ${meta.graceDays} day${meta.graceDays > 1 ? "s" : ""} without breaking your streak.`}
          </div>
        </div>

        {meta.streakResets?.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "8px", letterSpacing: "0.3em", color: "#333", textTransform: "uppercase", marginBottom: "10px" }}>RESET HISTORY</div>
            {meta.streakResets.map((r, i) => (
              <div key={i} style={{ fontSize: "10px", color: "#333", letterSpacing: "0.05em", marginBottom: "4px" }}>
                {formatDate(r.date)} — was at {r.streakAt} days
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onResetRequest} style={{ flex: 1, background: "#0e0808", border: "1px solid #2a1212", color: "#666", padding: "10px", fontSize: "7px", letterSpacing: "0.3em", textTransform: "uppercase", cursor: "pointer", fontFamily: "monospace", borderRadius: "2px" }}>
            RESET STREAK
          </button>
          <button onClick={onClose} style={{ flex: 1, background: "none", border: "1px solid #222", color: "#555", padding: "10px", fontSize: "7px", letterSpacing: "0.3em", textTransform: "uppercase", cursor: "pointer", fontFamily: "monospace", borderRadius: "2px" }}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData] = useState({});
  const [meta, setMeta] = useState({ graceDays: 0, streakResets: [] });
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("today");
  const [statsMode, setStatsMode] = useState("week");
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const prevStreakRef = useRef(0);

  const today = getTodayKey();
  const activeDate = selectedDate || today;
  const commitments = getDayCommitments(activeDate);
  const dayOfWeek = new Date(activeDate + "T00:00:00").getDay();
  const isRestDay = dayOfWeek === 0 || dayOfWeek === 4;
  const isToday = activeDate === today;

  // ── Load ──
  useEffect(() => {
    const savedData = storageGet(STORAGE_KEY) || {};
    const savedMeta = storageGet(META_KEY) || { graceDays: 0, streakResets: [] };
    setData(savedData);
    setMeta(savedMeta);
    setNote(savedData[today]?.note || "");
    prevStreakRef.current = getStreak(savedData, savedMeta.graceDays);
    setLoaded(true);
  }, []);

  // ── Save ──
  function save(newData) {
    setData(newData);
    storageSet(STORAGE_KEY, newData);
    const newStreak = getStreak(newData, meta.graceDays);
    if (STREAK_MILESTONES.includes(newStreak) && newStreak > prevStreakRef.current) {
      setCelebration(newStreak);
    }
    prevStreakRef.current = newStreak;
  }

  function saveMeta(newMeta) {
    setMeta(newMeta);
    storageSet(META_KEY, newMeta);
  }

  // ── Actions ──
  function toggleCheck(id) {
    save({
      ...data,
      [activeDate]: {
        ...data[activeDate],
        checks: { ...(data[activeDate]?.checks || {}), [id]: !data[activeDate]?.checks?.[id] },
        note: data[activeDate]?.note || "",
      },
    });
  }

  function saveNote() {
    save({ ...data, [activeDate]: { ...data[activeDate], checks: data[activeDate]?.checks || {}, note } });
  }

  function handleResetConfirm() {
    const newMeta = { ...meta, streakResets: [...(meta.streakResets || []), { date: today, streakAt: streak }] };
    saveMeta(newMeta);
    const newData = {};
    for (const key of Object.keys(data)) {
      newData[key] = { ...data[key], checks: {} };
    }
    save(newData);
    setShowResetConfirm(false);
  }

  function exportData() {
    const payload = { data, meta, exported: today };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracker-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function goToDate(dateStr) {
    setSelectedDate(dateStr === today ? null : dateStr);
    setNote(data[dateStr]?.note || "");
  }

  // ── Derived state ──
  const checks = data[activeDate]?.checks || {};
  const doneCount = commitments.filter(c => !!checks[c.id]).length;
  const total = commitments.length;
  const allDone = doneCount === total;
  const streak = getStreak(data, meta.graceDays);

  const weekStart = getWeekStart(today);
  const weekStats = getWeekStats(data, weekStart);
  const monthStats = getMonthStats(data, getMonthKey(today));
  const weekCatStats = getCategoryStats(data, weekStats.days.filter(k => data[k]));
  const monthCatStats = getCategoryStats(data, Object.keys(data).filter(k => k.startsWith(getMonthKey(today))));
  const allDates = Object.keys(data).sort().reverse();

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontFamily: "monospace", fontSize: "12px", letterSpacing: "0.3em" }}>
      LOADING...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8e8e0", fontFamily: "'Courier New', monospace", maxWidth: "600px", margin: "0 auto" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
        @keyframes scaleUp { from { transform:scale(0.5); opacity:0 } to { transform:scale(1); opacity:1 } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes streakPop { 0%{transform:scale(1)} 50%{transform:scale(1.12)} 100%{transform:scale(1)} }
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        textarea:focus { border-color:#2e2e2e !important; outline:none; }
        input[type="date"] { color-scheme:dark; }
      `}</style>

      {/* Modals */}
      {celebration && <StreakCelebration streak={celebration} onDone={() => setCelebration(null)} />}
      {showResetConfirm && <ResetConfirm streak={streak} onConfirm={handleResetConfirm} onCancel={() => setShowResetConfirm(false)} />}
      {showSettings && (
        <Settings
          meta={meta}
          streak={streak}
          onUpdateMeta={saveMeta}
          onResetRequest={() => { setShowResetConfirm(true); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1e1e", padding: "20px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "8px", letterSpacing: "0.4em", color: "#444", marginBottom: "6px", textTransform: "uppercase" }}>Daily Accountability</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", letterSpacing: "0.03em", color: "#e8e8e0", lineHeight: 1.2 }}>
            DID YOU DO WHAT<br />YOU SAID YOU'D DO?
          </div>
        </div>
        <div onClick={() => setShowSettings(true)} style={{ textAlign: "right", cursor: "pointer" }}>
          <div style={{ fontSize: "40px", fontWeight: "bold", color: streak > 0 ? "#e8a87c" : "#2a2a2a", lineHeight: 1, animation: streak > 0 ? "streakPop 0.3s ease" : "none" }}>{streak}</div>
          <div style={{ fontSize: "7px", letterSpacing: "0.3em", color: "#444", textTransform: "uppercase", marginTop: "2px" }}>
            DAY STREAK{meta.graceDays > 0 ? ` · ${meta.graceDays}G` : ""}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", borderBottom: "1px solid #161616", padding: "0 20px", overflowX: "auto" }}>
        {["today", "stats", "history"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ background: "none", border: "none", color: view === v ? "#e8e8e0" : "#3a3a3a", fontSize: "8px", letterSpacing: "0.35em", textTransform: "uppercase", padding: "12px 0", marginRight: "24px", cursor: "pointer", borderBottom: view === v ? "1px solid #e8e8e0" : "1px solid transparent", fontFamily: "'Courier New', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>{v}</button>
        ))}
        <button onClick={exportData} style={{ background: "none", border: "none", color: "#2a2a2a", fontSize: "8px", letterSpacing: "0.35em", textTransform: "uppercase", padding: "12px 0", marginLeft: "auto", cursor: "pointer", fontFamily: "'Courier New', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>EXPORT</button>
      </div>

      <div style={{ padding: "20px", animation: "fadeIn 0.2s ease" }}>

        {/* ── TODAY ── */}
        {view === "today" && (
          <>
            {/* Date nav */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button onClick={() => goToDate(addDays(activeDate, -1))} style={{ background: "none", border: "1px solid #222", color: "#555", width: "28px", height: "28px", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "2px", flexShrink: 0 }}>‹</button>
                <div onClick={() => setShowDatePicker(!showDatePicker)} style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: isToday ? "#888" : "#e8a87c", textTransform: "uppercase" }}>
                    {isToday ? "TODAY — " : ""}{formatDate(activeDate)}
                  </div>
                </div>
                <button onClick={() => { const next = addDays(activeDate, 1); if (next <= today) goToDate(next); }} style={{ background: "none", border: "1px solid #222", color: activeDate >= today ? "#1e1e1e" : "#555", width: "28px", height: "28px", cursor: activeDate >= today ? "default" : "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "2px", flexShrink: 0 }}>›</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {!isToday && <button onClick={() => goToDate(today)} style={{ background: "none", border: "1px solid #1e3a2a", color: "#7ce8a8", fontSize: "7px", letterSpacing: "0.25em", padding: "4px 8px", cursor: "pointer", fontFamily: "'Courier New', monospace", textTransform: "uppercase", borderRadius: "2px" }}>TODAY</button>}
                <div style={{ fontSize: "7px", letterSpacing: "0.25em", color: isRestDay ? "#2e2e2e" : "#e8a87c", textTransform: "uppercase", padding: "4px 8px", border: `1px solid ${isRestDay ? "#1a1a1a" : "#3a2a1a"}`, borderRadius: "2px" }}>{DAY_LABELS[dayOfWeek]}</div>
              </div>
            </div>

            {showDatePicker && (
              <div style={{ marginBottom: "20px" }}>
                <input type="date" max={today} value={activeDate}
                  onChange={e => { if (e.target.value) { goToDate(e.target.value); setShowDatePicker(false); } }}
                  style={{ background: "#111", border: "1px solid #2e2e2e", color: "#e8e8e0", padding: "8px 12px", fontFamily: "'Courier New', monospace", fontSize: "12px", width: "100%", outline: "none", borderRadius: "2px" }}
                />
              </div>
            )}

            {/* Progress */}
            <div style={{ height: "1px", background: "#1a1a1a", marginBottom: "24px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: total > 0 ? `${(doneCount / total) * 100}%` : "0%", background: allDone ? "#7ce8a8" : "#e8a87c", transition: "width 0.5s ease" }} />
            </div>

            {/* Commitments */}
            <div style={{ marginBottom: "28px" }}>
              {commitments.map((c, i) => {
                const done = !!checks[c.id];
                return (
                  <div key={c.id} onClick={() => toggleCheck(c.id)} style={{ display: "flex", alignItems: "center", padding: "15px 0", borderBottom: i < commitments.length - 1 ? "1px solid #141414" : "none", cursor: "pointer", WebkitUserSelect: "none", userSelect: "none" }}>
                    <div style={{ width: "20px", height: "20px", border: `1px solid ${done ? categoryColors[c.category] : "#2e2e2e"}`, borderRadius: "3px", marginRight: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: done ? categoryColors[c.category] : "transparent", transition: "all 0.15s", flexShrink: 0 }}>
                      {done && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3 5.5L8 1" stroke="#0d0d0d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <div style={{ flex: 1, fontSize: "13px", letterSpacing: "0.03em", textDecoration: done ? "line-through" : "none", color: done ? "#333" : "#d8d8d0", transition: "color 0.15s", lineHeight: 1.4 }}>{c.text}</div>
                    <div style={{ fontSize: "7px", letterSpacing: "0.25em", color: done ? "#2e2e2e" : categoryColors[c.category], textTransform: "uppercase", marginLeft: "10px", flexShrink: 0 }}>{categoryLabels[c.category]}</div>
                  </div>
                );
              })}
            </div>

            {allDone && (
              <div style={{ border: "1px solid #1e3a2a", background: "#0e1e14", padding: "12px 16px", marginBottom: "24px", borderRadius: "2px", animation: "fadeIn 0.4s ease" }}>
                <div style={{ fontSize: "8px", letterSpacing: "0.4em", color: "#7ce8a8", textTransform: "uppercase" }}>
                  YES. {streak > 1 ? `${streak} DAYS STRAIGHT.` : "TODAY YOU DID."}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: "7px", letterSpacing: "0.35em", color: "#303030", textTransform: "uppercase", marginBottom: "8px" }}>One honest observation</div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                onBlur={saveNote}
                placeholder="What actually happened today..."
                style={{ width: "100%", background: "#0f0f0f", border: "1px solid #1a1a1a", color: "#777", fontSize: "12px", padding: "12px", fontFamily: "'Courier New', monospace", lineHeight: "1.7", resize: "none", height: "72px", outline: "none", borderRadius: "2px", letterSpacing: "0.03em" }}
              />
            </div>
          </>
        )}

        {/* ── STATS ── */}
        {view === "stats" && (
          <>
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
              {["week", "month"].map(m => (
                <button key={m} onClick={() => setStatsMode(m)} style={{ background: statsMode === m ? "#1a1a1a" : "none", border: "1px solid #222", color: statsMode === m ? "#e8e8e0" : "#444", fontSize: "8px", letterSpacing: "0.3em", textTransform: "uppercase", padding: "8px 14px", cursor: "pointer", fontFamily: "'Courier New', monospace", borderRadius: "2px" }}>{m}</button>
              ))}
            </div>

            {(() => {
              const isWeek = statsMode === "week";
              const s = isWeek ? weekStats : monthStats;
              const pct = s.totalPossible > 0 ? Math.round((s.totalDone / s.totalPossible) * 100) : 0;
              const catStats = isWeek ? weekCatStats : monthCatStats;
              const best = bestCategory(catStats);

              return (
                <>
                  <div style={{ fontSize: "9px", letterSpacing: "0.3em", color: "#444", marginBottom: "20px", textTransform: "uppercase" }}>
                    {isWeek ? `This Week — ${formatDate(weekStart)}` : formatMonthYear(today)}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
                    {[
                      { label: "PERFECT", value: s.perfect, color: "#7ce8a8" },
                      { label: "PARTIAL", value: s.partial, color: "#e8a87c" },
                      { label: isWeek ? "MISSED" : "TRACKED", value: isWeek ? s.missed : s.tracked, color: isWeek ? "#444" : "#7cb9e8" },
                    ].map(stat => (
                      <div key={stat.label} style={{ border: "1px solid #1a1a1a", padding: "14px 10px", textAlign: "center", borderRadius: "2px" }}>
                        <div style={{ fontSize: "26px", fontWeight: "bold", color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                        <div style={{ fontSize: "7px", letterSpacing: "0.2em", color: "#333", textTransform: "uppercase", marginTop: "5px" }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <div style={{ fontSize: "8px", letterSpacing: "0.25em", color: "#444", textTransform: "uppercase" }}>OVERALL</div>
                      <div style={{ fontSize: "8px", color: pct >= 80 ? "#7ce8a8" : "#e8a87c" }}>{pct}%</div>
                    </div>
                    <div style={{ height: "2px", background: "#1a1a1a", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#7ce8a8" : "#e8a87c", transition: "width 0.6s ease" }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <div style={{ fontSize: "8px", letterSpacing: "0.3em", color: "#333", textTransform: "uppercase" }}>BY CATEGORY</div>
                      {best && (
                        <div style={{ fontSize: "7px", letterSpacing: "0.2em", padding: "3px 8px", border: `1px solid ${categoryColors[best]}33`, color: categoryColors[best], textTransform: "uppercase", borderRadius: "2px" }}>
                          {categoryLabels[best]} LEADING
                        </div>
                      )}
                    </div>
                    {["body", "build", "self"].map(cat => (
                      <CategoryBar key={cat} label={categoryLabels[cat]} done={catStats[cat].done} total={catStats[cat].total} color={categoryColors[cat]} />
                    ))}
                  </div>

                  {isWeek && (
                    <>
                      <div style={{ fontSize: "8px", letterSpacing: "0.25em", color: "#333", textTransform: "uppercase", marginBottom: "10px" }}>DAYS</div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {weekStats.days.map(key => {
                          const dayC = getDayCommitments(key);
                          const dayChecks = data[key]?.checks || {};
                          const done = dayC.filter(c => !!dayChecks[c.id]).length;
                          const isPerfect = done === dayC.length;
                          const isPartial = done > 0 && !isPerfect;
                          const label = new Date(key + "T00:00:00").toLocaleDateString("en-GB", { weekday: "narrow" });
                          return (
                            <div key={key} onClick={() => { goToDate(key); setView("today"); }} style={{ flex: 1, textAlign: "center", cursor: "pointer" }}>
                              <div style={{ width: "100%", aspectRatio: "1", borderRadius: "3px", background: isPerfect ? "#7ce8a8" : isPartial ? "#3a2a1a" : "#141414", border: key === today ? "1px solid #444" : "1px solid transparent", marginBottom: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {isPerfect && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="#0d0d0d" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                              </div>
                              <div style={{ fontSize: "7px", color: "#333", letterSpacing: "0.1em" }}>{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* ── HISTORY ── */}
        {view === "history" && (
          <>
            <div style={{ fontSize: "9px", letterSpacing: "0.3em", color: "#444", marginBottom: "20px", textTransform: "uppercase" }}>
              All Days — {allDates.length} logged
            </div>
            {allDates.length === 0 && (
              <div style={{ color: "#2e2e2e", fontSize: "12px", letterSpacing: "0.1em" }}>No history yet. Come back tomorrow.</div>
            )}
            {allDates.map(dateKey => {
              const dayC = getDayCommitments(dateKey);
              const day = data[dateKey];
              const dayChecks = day?.checks || {};
              const dayDone = dayC.filter(c => !!dayChecks[c.id]).length;
              const dayTotal = dayC.length;
              const perfect = dayDone === dayTotal;
              const isActive = dateKey === today;
              return (
                <div key={dateKey} onClick={() => { goToDate(dateKey); setView("today"); }} style={{ padding: "14px 0", borderBottom: "1px solid #141414", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: day?.note ? "6px" : "0" }}>
                    <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: isActive ? "#e8e8e0" : "#666" }}>
                      {isActive ? "Today — " : ""}{formatDate(dateKey)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ fontSize: "8px", letterSpacing: "0.2em", color: perfect ? "#7ce8a8" : dayDone > 0 ? "#e8a87c" : "#2e2e2e", textTransform: "uppercase" }}>
                        {dayDone}/{dayTotal}{perfect ? " ✓" : ""}
                      </div>
                      <div style={{ fontSize: "9px", color: "#2e2e2e" }}>›</div>
                    </div>
                  </div>
                  {day?.note && (
                    <div style={{ fontSize: "11px", color: "#333", letterSpacing: "0.02em", lineHeight: "1.5", fontStyle: "italic" }}>"{day.note}"</div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
