import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, CalendarDays, BedDouble, RefreshCw, Megaphone,
  ClipboardCheck, Globe2, Bot, Bell, Search, ChevronDown, TrendingUp,
  Users, DollarSign, ArrowUpRight, MoreHorizontal, CheckCircle2,
  Clock3, Wrench, Send, Plus, CreditCard, Wifi, RotateCcw, X,
  SlidersHorizontal, Building2, Moon, UserRound, ExternalLink,
  MessageSquare, Sparkles, BarChart3, Home
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar
} from "recharts";

const revenueData = [
  { d: "Mon", revenue: 6200, bookings: 17 },
  { d: "Tue", revenue: 7100, bookings: 22 },
  { d: "Wed", revenue: 6800, bookings: 20 },
  { d: "Thu", revenue: 8200, bookings: 26 },
  { d: "Fri", revenue: 9400, bookings: 31 },
  { d: "Sat", revenue: 11100, bookings: 36 },
  { d: "Sun", revenue: 10150, bookings: 33 }
];

const channelData = [
  { name: "Direct", value: 38 },
  { name: "Booking.com", value: 27 },
  { name: "Airbnb", value: 18 },
  { name: "Expedia", value: 10 },
  { name: "Agoda", value: 7 }
];

const seedBookings = [
  { id: "SP-1048", guest: "Olivia Martin", room: "204", type: "Deluxe King", source: "Booking.com", checkIn: "Today", checkOut: "Sep 26", guests: 2, total: 684, status: "Confirmed" },
  { id: "SP-1047", guest: "Noah Williams", room: "108", type: "City Queen", source: "Airbnb", checkIn: "Today", checkOut: "Sep 25", guests: 2, total: 418, status: "Checked in" },
  { id: "SP-1046", guest: "Ava Garcia", room: "211", type: "Sky Suite", source: "Direct Website", checkIn: "Today", checkOut: "Sep 28", guests: 3, total: 1180, status: "Confirmed" },
  { id: "SP-1045", guest: "Liam Chen", room: "105", type: "City Queen", source: "Expedia", checkIn: "Sep 24", checkOut: "Sep 27", guests: 2, total: 527, status: "Confirmed" },
  { id: "SP-1044", guest: "Sophia Brown", room: "202", type: "Deluxe King", source: "Agoda", checkIn: "Sep 24", checkOut: "Sep 26", guests: 2, total: 456, status: "Confirmed" },
  { id: "SP-1043", guest: "Ethan Lee", room: "110", type: "City Queen", source: "Direct Website", checkIn: "Sep 25", checkOut: "Sep 29", guests: 1, total: 612, status: "Confirmed" }
];

const makeRooms = () => Array.from({ length: 24 }, (_, i) => {
  const floor = i < 12 ? 1 : 2;
  const number = String(floor * 100 + (i % 12) + 1);
  const type = i % 6 === 0 ? "Sky Suite" : i % 2 === 0 ? "Deluxe King" : "City Queen";
  const preset = {
    "204": "Reserved", "108": "Occupied", "211": "Reserved",
    "105": "Reserved", "202": "Reserved", "110": "Reserved",
    "103": "Cleaning", "207": "Maintenance"
  };
  return { number, type, status: preset[number] || (i % 5 === 0 ? "Occupied" : "Available") };
});

const initialActivities = [
  { id: 1, tone: "blue", title: "Booking.com reservation synced", meta: "SP-1048 · Deluxe King · $684", time: "2 min ago" },
  { id: 2, tone: "green", title: "Direct payment captured", meta: "Visa •••• 4482 · $1,180", time: "6 min ago" },
  { id: 3, tone: "violet", title: "Meta Ads conversion attributed", meta: "Weekend Escape · ROAS 6.2x", time: "11 min ago" },
  { id: 4, tone: "amber", title: "Room 103 moved to cleaning", meta: "Housekeeping · priority normal", time: "18 min ago" }
];

const campaigns = [
  { name: "Weekend Escape", network: "Meta", spend: 842, bookings: 19, revenue: 5220, roas: 6.2, status: "Active" },
  { name: "Direct Booking Advantage", network: "Google", spend: 610, bookings: 14, revenue: 3740, roas: 6.1, status: "Active" },
  { name: "Autumn City Break", network: "Meta", spend: 488, bookings: 9, revenue: 2160, roas: 4.4, status: "Active" }
];

const channels = [
  { name: "Direct Website", short: "DW", color: "green", fee: "0% OTA commission", sync: "Live", inventory: 9, rate: "$179 avg" },
  { name: "Booking.com", short: "B", color: "blue", fee: "15% commission", sync: "Live", inventory: 9, rate: "$189 avg" },
  { name: "Airbnb", short: "A", color: "coral", fee: "3% host fee", sync: "Live", inventory: 9, rate: "$184 avg" },
  { name: "Expedia", short: "E", color: "yellow", fee: "18% commission", sync: "Live", inventory: 9, rate: "$192 avg" },
  { name: "Agoda", short: "AG", color: "violet", fee: "17% commission", sync: "Live", inventory: 9, rate: "$186 avg" }
];

const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["reservations", "Reservations", CalendarDays],
  ["rooms", "Rooms & inventory", BedDouble],
  ["channels", "Channel manager", RefreshCw],
  ["marketing", "Marketing", Megaphone],
  ["operations", "Operations", ClipboardCheck],
  ["booking", "Booking engine", Globe2],
  ["assistant", "AI assistant", Bot]
];

const fmt = n => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};

function StatusDot({ status }) {
  return <span className={"status status-" + status.toLowerCase().replaceAll(" ", "-")}><i />{status}</span>;
}

function PageHeader({ eyebrow, title, text, action }) {
  return <div className="page-head">
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
    {action}
  </div>;
}

function App() {
  const [active, setActive] = useState("overview");
  const [rooms, setRooms] = useState(() => load("sp-rooms", makeRooms()));
  const [bookings, setBookings] = useState(() => load("sp-bookings", seedBookings));
  const [activities, setActivities] = useState(() => load("sp-activities", initialActivities));
  const [rateMultiplier, setRateMultiplier] = useState(() => load("sp-rate", 1));
  const [metaPaused, setMetaPaused] = useState(() => load("sp-meta-paused", false));
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const liveIndex = useRef(0);

  useEffect(() => localStorage.setItem("sp-rooms", JSON.stringify(rooms)), [rooms]);
  useEffect(() => localStorage.setItem("sp-bookings", JSON.stringify(bookings)), [bookings]);
  useEffect(() => localStorage.setItem("sp-activities", JSON.stringify(activities)), [activities]);
  useEffect(() => localStorage.setItem("sp-rate", JSON.stringify(rateMultiplier)), [rateMultiplier]);
  useEffect(() => localStorage.setItem("sp-meta-paused", JSON.stringify(metaPaused)), [metaPaused]);

  useEffect(() => {
    const pool = [
      ["blue", "Inventory sync completed", "5 channels · 24 rooms reconciled"],
      ["green", "Payment authorized", "Direct booking engine · secure checkout"],
      ["violet", "Campaign attribution updated", "Meta Ads · 1 new assisted conversion"],
      ["blue", "Rate plan pushed to channels", "BAR plan · all channels acknowledged"]
    ];
    const timer = setInterval(() => {
      const item = pool[liveIndex.current % pool.length];
      liveIndex.current += 1;
      setActivities(prev => [{ id: Date.now(), tone: item[0], title: item[1], meta: item[2], time: "just now" }, ...prev].slice(0, 8));
    }, 11000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const occupied = rooms.filter(r => ["Occupied", "Reserved"].includes(r.status)).length;
    const occupancy = Math.round((occupied / rooms.length) * 100);
    const bookingRevenue = bookings.reduce((a, b) => a + Number(b.total || 0), 0);
    return {
      occupancy,
      available: rooms.filter(r => r.status === "Available").length,
      arrivals: bookings.filter(b => b.checkIn === "Today").length,
      revenue: 18420 + bookingRevenue,
      adr: Math.round(182 * rateMultiplier),
      revpar: Math.round(153 * rateMultiplier)
    };
  }, [rooms, bookings, rateMultiplier]);

  const pushActivity = (tone, title, meta) => {
    setActivities(prev => [{ id: Date.now(), tone, title, meta, time: "just now" }, ...prev].slice(0, 8));
  };

  const flash = text => {
    setNotice(text);
    setTimeout(() => setNotice(""), 2600);
  };

  const resetDemo = () => {
    setRooms(makeRooms());
    setBookings(seedBookings);
    setActivities(initialActivities);
    setRateMultiplier(1);
    setMetaPaused(false);
    localStorage.removeItem("sp-rooms");
    localStorage.removeItem("sp-bookings");
    localStorage.removeItem("sp-activities");
    localStorage.removeItem("sp-rate");
    localStorage.removeItem("sp-meta-paused");
    flash("Demo data reset");
  };

  const pageProps = {
    rooms, setRooms, bookings, setBookings, activities, setActivities,
    rateMultiplier, setRateMultiplier, metaPaused, setMetaPaused,
    stats, pushActivity, flash, setActive
  };

  return <div className="app-shell">
    <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
      <div className="brand">
        <div className="brand-mark"><Building2 size={20} /></div>
        <div><strong>StayPilot</strong><span>Hotel OS</span></div>
      </div>
      <div className="property-card">
        <div className="property-thumb"><Moon size={18} /></div>
        <div><b>Northstar Grand</b><span>Chattogram · Demo</span></div>
        <ChevronDown size={16} />
      </div>
      <nav>
        <div className="nav-label">Workspace</div>
        {nav.map(([id, label, Icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); setMobileNav(false); }}>
          <Icon size={18} /><span>{label}</span>{id === "assistant" && <em>AI</em>}
        </button>)}
      </nav>
      <div className="sidebar-foot">
        <div className="system-health"><span className="live-dot" /><div><b>All systems operational</b><span>5 channels synced</span></div></div>
        <button className="reset-btn" onClick={resetDemo}><RotateCcw size={15} /> Reset demo</button>
        <div className="prototype-tag">Interactive portfolio prototype</div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileNav(v => !v)}><SlidersHorizontal size={18} /></button>
        <div className="search"><Search size={17} /><span>Search reservations, rooms, guests...</span><kbd>⌘ K</kbd></div>
        <div className="top-actions">
          <div className="live-pill"><span /> Live demo</div>
          <button className="icon-btn"><Bell size={18} /><i /></button>
          <div className="avatar">SR</div>
          <div className="profile"><b>Sam Rahman</b><span>General Manager</span></div>
          <ChevronDown size={16} />
        </div>
      </header>

      <div className="content">
        {active === "overview" && <Overview {...pageProps} />}
        {active === "reservations" && <Reservations {...pageProps} />}
        {active === "rooms" && <Rooms {...pageProps} />}
        {active === "channels" && <Channels {...pageProps} />}
        {active === "marketing" && <Marketing {...pageProps} />}
        {active === "operations" && <Operations {...pageProps} />}
        {active === "booking" && <BookingEngine {...pageProps} />}
        {active === "assistant" && <Assistant {...pageProps} />}
      </div>
    </main>

    {notice && <div className="toast"><CheckCircle2 size={18} />{notice}<button onClick={() => setNotice("")}><X size={14} /></button></div>}
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
  </div>;
}

function Overview({ stats, activities, setActive }) {
  const kpis = [
    ["Occupancy", stats.occupancy + "%", "+6.8%", TrendingUp, "vs. last week"],
    ["Revenue today", fmt(stats.revenue), "+12.4%", DollarSign, "gross room revenue"],
    ["Available rooms", String(stats.available), "Live", BedDouble, "of 24 rooms"],
    ["Arrivals today", String(stats.arrivals), "3 VIP", Users, "next at 14:30"]
  ];
  return <>
    <PageHeader eyebrow="Wednesday · September 23" title="Good afternoon, Sam." text="Here’s what is happening across Northstar Grand right now." action={<button className="primary-btn" onClick={() => setActive("booking")}><Plus size={16} /> New reservation</button>} />

    <section className="kpi-grid">
      {kpis.map(([label, value, trend, Icon, sub]) => <article className="kpi-card" key={label}>
        <div className="kpi-top"><span>{label}</span><div className="kpi-icon"><Icon size={18} /></div></div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-meta"><b>{trend}</b><span>{sub}</span></div>
      </article>)}
    </section>

    <section className="dashboard-grid">
      <article className="panel chart-panel">
        <div className="panel-head"><div><span className="panel-kicker">Performance</span><h3>Revenue & booking pace</h3></div><button className="ghost-btn">Last 7 days <ChevronDown size={14} /></button></div>
        <div className="chart-stat"><b>$58,950</b><span><TrendingUp size={13} /> 14.2% vs previous period</span></div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b8cff" stopOpacity={0.36} /><stop offset="100%" stopColor="#5b8cff" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="#e8edf5" vertical={false} />
              <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fill: "#78859a", fontSize: 12 }} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4eaf2", boxShadow: "0 10px 30px rgba(20,35,60,.12)" }} formatter={v => [fmt(v), "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#356df3" strokeWidth={2.5} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="panel activity-panel">
        <div className="panel-head"><div><span className="panel-kicker">Live operations</span><h3>Activity stream</h3></div><span className="live-label"><i /> updating</span></div>
        <div className="activity-list">
          {activities.slice(0, 5).map(a => <div className="activity-item" key={a.id}>
            <span className={"activity-icon " + a.tone}><Wifi size={14} /></span>
            <div><b>{a.title}</b><span>{a.meta}</span></div><time>{a.time}</time>
          </div>)}
        </div>
        <button className="text-btn" onClick={() => setActive("operations")}>View operations <ArrowUpRight size={14} /></button>
      </article>
    </section>

    <section className="bottom-grid">
      <article className="panel channel-panel">
        <div className="panel-head"><div><span className="panel-kicker">Distribution</span><h3>Booking channel mix</h3></div><button className="icon-btn flat"><MoreHorizontal size={18} /></button></div>
        <div className="bar-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelData} barSize={24}>
              <CartesianGrid stroke="#edf1f7" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#78859a", fontSize: 11 }} />
              <YAxis hide />
              <Tooltip cursor={{ fill: "#f5f7fb" }} contentStyle={{ borderRadius: 12, border: "1px solid #e4eaf2" }} formatter={v => [v + "%", "Share"]} />
              <Bar dataKey="value" fill="#5b8cff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="panel snapshot">
        <div className="panel-head"><div><span className="panel-kicker">Today</span><h3>Property snapshot</h3></div></div>
        <div className="snapshot-grid">
          <div><span>ADR</span><b>{fmt(stats.adr)}</b><small>+4.8%</small></div>
          <div><span>RevPAR</span><b>{fmt(stats.revpar)}</b><small>+9.2%</small></div>
          <div><span>Direct share</span><b>38%</b><small>+7 pts</small></div>
          <div><span>Guest rating</span><b>4.8</b><small>218 reviews</small></div>
        </div>
        <div className="goal"><div><span>Direct booking goal</span><b>76%</b></div><div className="progress"><i style={{ width: "76%" }} /></div><p>19 bookings away from this month’s target.</p></div>
      </article>
    </section>
  </>;
}

function Reservations({ bookings, setActive }) {
  const [filter, setFilter] = useState("All");
  const list = filter === "All" ? bookings : bookings.filter(b => b.status === filter);
  return <>
    <PageHeader eyebrow="Reservations" title="Bookings, without the channel chaos." text="Every reservation lands in one timeline with source, payment and room assignment visible." action={<button className="primary-btn" onClick={() => setActive("booking")}><Plus size={16} /> Add reservation</button>} />
    <div className="toolbar">
      <div className="segmented">{["All", "Confirmed", "Checked in"].map(x => <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x}</button>)}</div>
      <button className="ghost-btn"><CalendarDays size={15} /> Sep 23 — Sep 30</button>
    </div>
    <article className="panel table-panel">
      <div className="table-scroll">
        <table>
          <thead><tr><th>Reservation</th><th>Guest</th><th>Stay</th><th>Room</th><th>Source</th><th>Value</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map(b => <tr key={b.id}>
            <td><b>{b.id}</b></td>
            <td><div className="guest-cell"><span>{b.guest.split(" ").map(x => x[0]).slice(0,2).join("")}</span><div><b>{b.guest}</b><small>{b.guests} guest{b.guests > 1 ? "s" : ""}</small></div></div></td>
            <td><b>{b.checkIn}</b><small>{b.checkOut}</small></td>
            <td><b>{b.room}</b><small>{b.type}</small></td>
            <td><span className={"source source-" + b.source.toLowerCase().replaceAll(" ","-").replace(".","")}>{b.source}</span></td>
            <td><b>{fmt(b.total)}</b><small>Paid / secured</small></td>
            <td><StatusDot status={b.status} /></td>
            <td><button className="icon-btn flat"><MoreHorizontal size={17} /></button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </article>
    <div className="mini-note"><Sparkles size={15} /> New direct bookings created in the Booking Engine appear here instantly and update room inventory.</div>
  </>;
}

function Rooms({ rooms, setRooms, pushActivity, flash }) {
  const grouped = ["Available", "Occupied", "Reserved", "Cleaning", "Maintenance"];
  const counts = Object.fromEntries(grouped.map(s => [s, rooms.filter(r => r.status === s).length]));
  const updateRoom = (number, status) => {
    setRooms(prev => prev.map(r => r.number === number ? { ...r, status } : r));
    pushActivity(status === "Available" ? "green" : "amber", "Room " + number + " status changed", status + " · updated from room control");
    flash("Room " + number + " moved to " + status);
  };
  return <>
    <PageHeader eyebrow="Inventory" title="One room inventory. Every channel." text="Availability, housekeeping and maintenance status remain visible in one operational view." action={<button className="ghost-btn"><RefreshCw size={15} /> Sync inventory</button>} />
    <section className="status-summary">{grouped.map(s => <div key={s}><span className={"room-dot " + s.toLowerCase()} /><div><b>{counts[s]}</b><span>{s}</span></div></div>)}</section>
    <article className="panel room-board">
      <div className="panel-head"><div><span className="panel-kicker">Floor plan</span><h3>Room status board</h3></div><div className="live-label"><i /> channel inventory live</div></div>
      <div className="room-grid">{rooms.map(r => <div className={"room-card " + r.status.toLowerCase()} key={r.number}>
        <div className="room-card-top"><b>{r.number}</b><span>{r.type}</span></div>
        <StatusDot status={r.status} />
        <div className="room-actions">
          {r.status !== "Available" && <button onClick={() => updateRoom(r.number, "Available")}><CheckCircle2 size={13} /> Ready</button>}
          {r.status !== "Cleaning" && <button onClick={() => updateRoom(r.number, "Cleaning")}><Clock3 size={13} /> Clean</button>}
          {r.status !== "Maintenance" && <button onClick={() => updateRoom(r.number, "Maintenance")}><Wrench size={13} /></button>}
        </div>
      </div>)}</div>
    </article>
  </>;
}

function Channels({ pushActivity, flash }) {
  const syncAll = () => {
    pushActivity("blue", "All channel inventories synced", "Booking.com · Airbnb · Expedia · Agoda · Direct");
    flash("All channels synced successfully");
  };
  return <>
    <PageHeader eyebrow="Distribution" title="Channel Manager" text="Rates and availability stay synchronized across direct and OTA channels from one control plane." action={<button className="primary-btn" onClick={syncAll}><RefreshCw size={16} /> Sync all channels</button>} />
    <div className="integration-hero panel">
      <div><span className="pulse-ring"><RefreshCw size={23} /></span><div><b>Universal inventory is healthy</b><p>Last full reconciliation: 38 seconds ago · no overbooking conflicts detected.</p></div></div>
      <div className="sync-stat"><b>99.99%</b><span>sync success</span></div>
    </div>
    <section className="integration-grid">{channels.map(c => <article className="panel integration-card" key={c.name}>
      <div className="integration-top"><span className={"channel-logo " + c.color}>{c.short}</span><div><b>{c.name}</b><span>{c.fee}</span></div><StatusDot status={c.sync} /></div>
      <div className="integration-metrics"><div><span>Sellable tonight</span><b>{c.inventory} rooms</b></div><div><span>Published rate</span><b>{c.rate}</b></div></div>
      <div className="integration-foot"><span><CheckCircle2 size={14} /> Inventory + rates connected</span><button><ExternalLink size={14} /></button></div>
    </article>)}</section>
    <div className="mini-note"><MessageSquare size={15} /> Portfolio demo: connectors model how Booking.com, Airbnb, Expedia, Agoda and the direct engine reconcile with one inventory. Production access requires each provider’s approved API credentials.</div>
  </>;
}

function Marketing({ metaPaused, setMetaPaused, pushActivity, flash }) {
  const toggleMeta = () => {
    const next = !metaPaused;
    setMetaPaused(next);
    pushActivity("violet", "Meta Ads campaign state updated", next ? "Meta campaigns paused from StayPilot" : "Meta campaigns resumed from StayPilot");
    flash(next ? "Meta campaigns paused" : "Meta campaigns resumed");
  };
  return <>
    <PageHeader eyebrow="Growth" title="Marketing & attribution" text="Connect ad spend to bookings and room revenue, not vanity metrics." action={<button className={metaPaused ? "primary-btn" : "danger-btn"} onClick={toggleMeta}>{metaPaused ? "Resume Meta Ads" : "Pause Meta Ads"}</button>} />
    <section className="kpi-grid marketing-kpis">
      <article className="kpi-card"><div className="kpi-top"><span>Ad-attributed revenue</span><BarChart3 size={18} /></div><div className="kpi-value">$11,120</div><div className="kpi-meta"><b>+21.4%</b><span>this month</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Total ad spend</span><DollarSign size={18} /></div><div className="kpi-value">$1,940</div><div className="kpi-meta"><b>5.73x</b><span>blended ROAS</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Direct booking CPA</span><TrendingUp size={18} /></div><div className="kpi-value">$46</div><div className="kpi-meta"><b>-12.8%</b><span>cost per booking</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Website conversion</span><Globe2 size={18} /></div><div className="kpi-value">4.9%</div><div className="kpi-meta"><b>+0.8 pt</b><span>vs. last month</span></div></article>
    </section>
    <article className="panel campaign-panel">
      <div className="panel-head"><div><span className="panel-kicker">Campaigns</span><h3>Revenue-connected advertising</h3></div><span className={"ads-state " + (metaPaused ? "paused" : "")}><i /> Meta {metaPaused ? "paused" : "live"}</span></div>
      <div className="table-scroll"><table><thead><tr><th>Campaign</th><th>Network</th><th>Spend</th><th>Bookings</th><th>Revenue</th><th>ROAS</th><th>Status</th></tr></thead><tbody>
        {campaigns.map(c => <tr key={c.name}><td><b>{c.name}</b></td><td><span className={"source " + (c.network === "Meta" ? "source-meta" : "source-google")}>{c.network}</span></td><td>{fmt(c.spend)}</td><td>{c.bookings}</td><td><b>{fmt(c.revenue)}</b></td><td><b>{c.roas}x</b></td><td><StatusDot status={c.network === "Meta" && metaPaused ? "Paused" : c.status} /></td></tr>)}
      </tbody></table></div>
    </article>
  </>;
}

function Operations({ activities }) {
  const tasks = [
    ["Room 103", "Full turnover", "Housekeeping", "Due 14:15", "In progress"],
    ["Room 207", "HVAC inspection", "Maintenance", "Due 15:00", "Assigned"],
    ["Lobby", "Welcome setup — VIP", "Front desk", "Due 16:00", "Queued"],
    ["Room 108", "Extra towels requested", "Housekeeping", "Due 16:20", "New"]
  ];
  const payments = [
    ["SP-1046", "Ava Garcia", "Direct Website", 1180, "Captured"],
    ["SP-1048", "Olivia Martin", "Booking.com", 684, "Secured"],
    ["SP-1043", "Ethan Lee", "Direct Website", 612, "Captured"]
  ];
  return <>
    <PageHeader eyebrow="Operations" title="The property command center." text="Housekeeping, maintenance, payments and live system events share one operational workspace." />
    <section className="ops-grid">
      <article className="panel">
        <div className="panel-head"><div><span className="panel-kicker">Service board</span><h3>Tasks & housekeeping</h3></div><button className="ghost-btn"><Plus size={14} /> Add task</button></div>
        <div className="task-list">{tasks.map(t => <div className="task" key={t[0] + t[1]}><span className="task-check" /><div><b>{t[0]} · {t[1]}</b><span>{t[2]} · {t[3]}</span></div><em>{t[4]}</em></div>)}</div>
      </article>
      <article className="panel">
        <div className="panel-head"><div><span className="panel-kicker">Payments</span><h3>Recent transactions</h3></div><CreditCard size={18} /></div>
        <div className="payment-list">{payments.map(p => <div key={p[0]}><span className="pay-icon"><CreditCard size={15} /></span><div><b>{p[1]}</b><span>{p[0]} · {p[2]}</span></div><strong>{fmt(p[3])}</strong><StatusDot status={p[4]} /></div>)}</div>
      </article>
    </section>
    <article className="panel ops-activity">
      <div className="panel-head"><div><span className="panel-kicker">Automation log</span><h3>Live system events</h3></div><span className="live-label"><i /> streaming</span></div>
      <div className="activity-list wide">{activities.map(a => <div className="activity-item" key={a.id}><span className={"activity-icon " + a.tone}><Wifi size={14} /></span><div><b>{a.title}</b><span>{a.meta}</span></div><time>{a.time}</time></div>)}</div>
    </article>
  </>;
}

function BookingEngine({ rooms, setRooms, bookings, setBookings, rateMultiplier, pushActivity, flash }) {
  const [form, setForm] = useState({ guest: "", email: "", type: "Deluxe King", nights: 2, guests: 2 });
  const [success, setSuccess] = useState(null);
  const rates = { "City Queen": 149, "Deluxe King": 189, "Sky Suite": 279 };
  const rate = Math.round(rates[form.type] * rateMultiplier);
  const total = rate * Number(form.nights || 1);
  const available = rooms.filter(r => r.status === "Available" && r.type === form.type);

  const submit = e => {
    e.preventDefault();
    if (!form.guest.trim()) return flash("Add a guest name first");
    const room = available[0];
    if (!room) return flash("No demo rooms available in this room type");
    const id = "SP-" + (1050 + bookings.length);
    const booking = { id, guest: form.guest, room: room.number, type: form.type, source: "Direct Website", checkIn: "Today", checkOut: form.nights + " nights", guests: Number(form.guests), total, status: "Confirmed" };
    setBookings(prev => [booking, ...prev]);
    setRooms(prev => prev.map(r => r.number === room.number ? { ...r, status: "Reserved" } : r));
    pushActivity("green", "New direct booking confirmed", id + " · Room " + room.number + " · " + fmt(total));
    setSuccess(booking);
    flash("Reservation " + id + " created");
  };

  return <>
    <PageHeader eyebrow="Direct booking" title="A booking engine connected to live inventory." text="This guest-facing checkout writes directly into the same reservation and room state used by the dashboard." />
    <div className="booking-demo">
      <section className="guest-site">
        <div className="guest-nav"><div className="hotel-logo"><span>N</span><div><b>Northstar</b><small>Grand Hotel</small></div></div><div><span>Rooms</span><span>Dining</span><span>Experience</span><button>Book your stay</button></div></div>
        <div className="hero-visual"><div className="hero-copy"><span>Stay at the center of everything.</span><h2>City energy.<br />Quiet luxury.</h2><p>A refined stay designed around how you actually travel.</p><div className="rating">★★★★★ <span>4.8 · 218 guest reviews</span></div></div><div className="visual-card"><Moon size={36} /><span>Northstar Grand</span></div></div>
        <div className="booking-strip"><div><small>Check in</small><b>Sep 23</b></div><div><small>Check out</small><b>Sep 25</b></div><div><small>Guests</small><b>{form.guests} guests</b></div><button>Check availability</button></div>
        <div className="guest-proof"><span><CheckCircle2 size={14} /> Best rate guarantee</span><span><CheckCircle2 size={14} /> Instant confirmation</span><span><CheckCircle2 size={14} /> Free changes up to 48h</span></div>
      </section>

      <aside className="checkout panel">
        <div className="checkout-head"><span className="panel-kicker">Live demo checkout</span><h3>Create a direct reservation</h3><p>Submit it, then open Reservations or Rooms to see the dashboard update.</p></div>
        {success ? <div className="booking-success"><span><CheckCircle2 size={30} /></span><h3>Reservation confirmed</h3><p>{success.guest} · Room {success.room}</p><div><b>{success.id}</b><b>{fmt(success.total)}</b></div><button className="secondary-btn" onClick={() => setSuccess(null)}>Create another booking</button></div> :
        <form onSubmit={submit}>
          <label>Guest name<input value={form.guest} onChange={e => setForm({ ...form, guest: e.target.value })} placeholder="e.g. Maya Thompson" /></label>
          <label>Email<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="guest@example.com" type="email" /></label>
          <div className="form-row"><label>Room type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>City Queen</option><option>Deluxe King</option><option>Sky Suite</option></select></label><label>Guests<select value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })}><option>1</option><option>2</option><option>3</option><option>4</option></select></label></div>
          <label>Nights<input min="1" max="14" type="number" value={form.nights} onChange={e => setForm({ ...form, nights: e.target.value })} /></label>
          <div className="availability-line"><span>{available.length} rooms available</span><b>{fmt(rate)} / night</b></div>
          <div className="total-line"><span>Total stay</span><b>{fmt(total)}</b></div>
          <button className="primary-btn full" type="submit">Confirm demo booking <ArrowUpRight size={16} /></button>
          <small className="form-note"><CreditCard size={13} /> Payment is simulated for this portfolio prototype.</small>
        </form>}
      </aside>
    </div>
  </>;
}

function Assistant({ rooms, setRooms, bookings, stats, rateMultiplier, setRateMultiplier, metaPaused, setMetaPaused, pushActivity, flash, setActive }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "I’m connected to reservations, room inventory, channel sync, marketing and property operations. Try a command or ask what needs attention." }
  ]);
  const [input, setInput] = useState("");

  const act = raw => {
    const q = raw.trim();
    if (!q) return;
    setMessages(m => [...m, { role: "user", text: q }]);
    setInput("");
    const lower = q.toLowerCase();
    let reply = "";

    const roomMatch = lower.match(/(?:block|maintenance|close) room (\d+)/);
    const readyMatch = lower.match(/(?:open|ready|clean) room (\d+)/);
    const rateMatch = lower.match(/(?:raise|increase).*(\d+)%/);

    if (roomMatch) {
      const num = roomMatch[1];
      setRooms(prev => prev.map(r => r.number === num ? { ...r, status: "Maintenance" } : r));
      pushActivity("amber", "Assistant blocked Room " + num, "Maintenance hold · inventory removed from channels");
      reply = "Done. Room " + num + " is now on maintenance hold and has been removed from sellable inventory.";
    } else if (readyMatch) {
      const num = readyMatch[1];
      setRooms(prev => prev.map(r => r.number === num ? { ...r, status: "Available" } : r));
      pushActivity("green", "Assistant released Room " + num, "Available · inventory pushed to channels");
      reply = "Room " + num + " is marked ready and returned to channel inventory.";
    } else if (rateMatch) {
      const pct = Math.min(Number(rateMatch[1]), 30);
      setRateMultiplier(v => Number((v * (1 + pct / 100)).toFixed(3)));
      pushActivity("blue", "Assistant adjusted BAR rates", "+" + pct + "% · synchronized to connected channels");
      reply = "Rates increased " + pct + "% across the demo BAR plan. Current ADR is now approximately " + fmt(Math.round(stats.adr * (1 + pct / 100))) + ".";
    } else if (lower.includes("pause") && lower.includes("meta")) {
      setMetaPaused(true);
      pushActivity("violet", "Assistant paused Meta campaigns", "All Meta campaigns moved to paused");
      reply = "Meta campaigns are paused. Google remains active and no reservation data was changed.";
    } else if ((lower.includes("resume") || lower.includes("start")) && lower.includes("meta")) {
      setMetaPaused(false);
      pushActivity("violet", "Assistant resumed Meta campaigns", "Campaign delivery re-enabled");
      reply = "Meta campaigns are active again.";
    } else if (lower.includes("sync")) {
      pushActivity("blue", "Assistant triggered channel sync", "5 channels acknowledged · no conflicts");
      reply = "Channel reconciliation completed. Booking.com, Airbnb, Expedia, Agoda and Direct all match the hotel inventory.";
    } else if (lower.includes("arrival")) {
      const arr = bookings.filter(b => b.checkIn === "Today");
      reply = "There are " + arr.length + " arrivals today: " + arr.map(b => b.guest + " in " + b.room).join(", ") + ".";
    } else if (lower.includes("occupancy")) {
      reply = "Current modeled occupancy is " + stats.occupancy + "%. " + stats.available + " rooms remain available to sell.";
    } else if (lower.includes("revenue")) {
      reply = "Today’s modeled gross room revenue is " + fmt(stats.revenue) + ". ADR is " + fmt(stats.adr) + " and RevPAR is " + fmt(stats.revpar) + ".";
    } else if (lower.includes("booking") || lower.includes("reservation")) {
      reply = "You have " + bookings.length + " reservations in the demo ledger. I can summarize arrivals, open the booking engine, or change room availability.";
    } else if (lower.includes("what needs") || lower.includes("attention")) {
      const maintenance = rooms.filter(r => r.status === "Maintenance").map(r => r.number);
      const cleaning = rooms.filter(r => r.status === "Cleaning").map(r => r.number);
      reply = "Priority check: " + (maintenance.length ? "maintenance in room " + maintenance.join(", ") + "; " : "") + (cleaning.length ? "cleaning pending in room " + cleaning.join(", ") + ". " : "") + "Channel sync is healthy. Meta Ads are " + (metaPaused ? "paused." : "active.");
    } else {
      reply = "I can operate this prototype. Try “show today’s arrivals”, “block room 207”, “mark room 103 ready”, “raise rates 8%”, “sync all channels”, or “pause Meta ads”.";
    }
    setTimeout(() => setMessages(m => [...m, { role: "assistant", text: reply }]), 350);
  };

  const quick = ["What needs attention?", "Show today’s arrivals", "Raise rates 8%", "Sync all channels", metaPaused ? "Resume Meta ads" : "Pause Meta ads", "Mark room 103 ready"];

  return <div className="assistant-page">
    <PageHeader eyebrow="Operator AI" title="Run the hotel from a conversation." text="Natural-language actions are wired to the same prototype state as reservations, room inventory, channels and marketing." action={<div className="assistant-online"><span /> Connected to 6 tools</div>} />
    <div className="assistant-layout">
      <section className="assistant-chat panel">
        <div className="chat-head"><div className="ai-orb"><Sparkles size={19} /></div><div><b>StayPilot Assistant</b><span>Property operator · action enabled</span></div><span className="live-label"><i /> online</span></div>
        <div className="messages">{messages.map((m, i) => <div className={"message " + m.role} key={i}>{m.role === "assistant" && <span className="mini-orb"><Sparkles size={13} /></span>}<div>{m.text}</div></div>)}</div>
        <div className="quick-prompts">{quick.map(q => <button key={q} onClick={() => act(q)}>{q}</button>)}</div>
        <form className="composer" onSubmit={e => { e.preventDefault(); act(input); }}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask or tell StayPilot what to do..." /><button><Send size={17} /></button></form>
      </section>
      <aside className="assistant-side">
        <article className="panel command-card"><span className="panel-kicker">Live property state</span><h3>What the assistant can touch</h3>
          <div className="tool-list">
            <div><CalendarDays size={16} /><span>Reservations</span><b>{bookings.length}</b></div>
            <div><BedDouble size={16} /><span>Room inventory</span><b>{stats.available} open</b></div>
            <div><RefreshCw size={16} /><span>Channel sync</span><b>Healthy</b></div>
            <div><Megaphone size={16} /><span>Meta Ads</span><b>{metaPaused ? "Paused" : "Live"}</b></div>
            <div><DollarSign size={16} /><span>BAR multiplier</span><b>{rateMultiplier.toFixed(2)}x</b></div>
          </div>
        </article>
        <article className="panel assistant-tip"><span><Bot size={19} /></span><h3>Action, not just answers.</h3><p>Commands update the dashboard immediately so a portfolio visitor can see the assistant functioning as an operational control layer.</p><button className="secondary-btn" onClick={() => setActive("rooms")}>Open room board <ArrowUpRight size={14} /></button></article>
      </aside>
    </div>
  </div>;
}

export default App;
