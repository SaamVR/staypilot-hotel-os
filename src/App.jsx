import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, CalendarDays, BedDouble, RefreshCw, Megaphone,
  ClipboardCheck, Globe2, Bot, Bell, Search, ChevronDown, TrendingUp,
  Users, DollarSign, ArrowUpRight, MoreHorizontal, CheckCircle2,
  Clock3, Wrench, Send, Plus, CreditCard, Wifi, RotateCcw, X,
  SlidersHorizontal, Building2, Moon, UserRound, ExternalLink,
  MessageSquare, Sparkles, BarChart3, Home, Settings2, KeyRound,
  Eye, EyeOff, ShieldCheck, PlugZap, Copy, Check, Database, Zap,
  Package, ReceiptText, ClipboardList, Boxes, UserCog, WalletCards
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

const seedCampaigns = [
  { id: "cmp-1", name: "Weekend Escape", network: "Meta", type: "Prospecting", spend: 842, budget: 95, bookings: 19, revenue: 5220, roas: 6.2, status: "Active" },
  { id: "cmp-2", name: "Direct Booking Advantage", network: "Google Search", type: "Direct demand", spend: 610, budget: 80, bookings: 14, revenue: 3740, roas: 6.1, status: "Active" },
  { id: "cmp-3", name: "Hotel Rate Capture", network: "Google Hotel Ads", type: "Metasearch", spend: 730, budget: 110, bookings: 17, revenue: 4680, roas: 6.4, status: "Active" },
  { id: "cmp-4", name: "City Weekend Video", network: "TikTok", type: "Video prospecting", spend: 376, budget: 55, bookings: 6, revenue: 1310, roas: 3.5, status: "Active" },
  { id: "cmp-5", name: "Brand + Location Search", network: "Microsoft Ads", type: "Search", spend: 244, budget: 35, bookings: 5, revenue: 1090, roas: 4.5, status: "Active" },
  { id: "cmp-6", name: "Abandoned Booking Return", network: "Meta", type: "Retargeting", spend: 292, budget: 45, bookings: 11, revenue: 2480, roas: 8.5, status: "Active" }
];

const seedAdChannels = [
  { id: "hotel", name: "Google Hotel Ads", short: "GH", tone: "blue", detail: "Search + Maps hotel module", budget: 110, roasTarget: 6, spend: 730, revenue: 4680, bookings: 17, enabled: true },
  { id: "google", name: "Google Search / PMax", short: "G", tone: "blue", detail: "Search, Display, YouTube", budget: 145, roasTarget: 5.5, spend: 610, revenue: 3740, bookings: 14, enabled: true },
  { id: "meta", name: "Meta Ads", short: "M", tone: "violet", detail: "Facebook + Instagram", budget: 140, roasTarget: 5, spend: 1134, revenue: 7700, bookings: 30, enabled: true },
  { id: "tiktok", name: "TikTok Ads", short: "TT", tone: "coral", detail: "Video + retargeting", budget: 55, roasTarget: 4, spend: 376, revenue: 1310, bookings: 6, enabled: true },
  { id: "microsoft", name: "Microsoft Ads", short: "MS", tone: "green", detail: "Bing search + lodging", budget: 35, roasTarget: 4.2, spend: 244, revenue: 1090, bookings: 5, enabled: true }
];

const channels = [
  { name: "Direct Website", short: "DW", color: "green", fee: "0% OTA commission", sync: "Live", inventory: 9, rate: "$179 avg" },
  { name: "Booking.com", short: "B", color: "blue", fee: "15% commission", sync: "Live", inventory: 9, rate: "$189 avg" },
  { name: "Airbnb", short: "A", color: "coral", fee: "3% host fee", sync: "Live", inventory: 9, rate: "$184 avg" },
  { name: "Expedia", short: "E", color: "yellow", fee: "18% commission", sync: "Live", inventory: 9, rate: "$192 avg" },
  { name: "Agoda", short: "AG", color: "violet", fee: "17% commission", sync: "Live", inventory: 9, rate: "$186 avg" }
];

const ownerNav = [
  ["overview", "Owner dashboard", LayoutDashboard],
  ["reservations", "Reservations", CalendarDays],
  ["rooms", "Rooms & availability", BedDouble],
  ["inventory", "Supplies & inventory", Boxes],
  ["expenses", "Expenses", ReceiptText],
  ["channels", "Channel manager", RefreshCw],
  ["marketing", "Marketing", Megaphone],
  ["operations", "Operations", ClipboardCheck],
  ["instructions", "Team instructions", ClipboardList],
  ["booking", "Booking engine", Globe2],
  ["assistant", "AI assistant", Bot],
  ["connections", "Connections & API", Settings2]
];

const managerNav = [
  ["overview", "Manager dashboard", LayoutDashboard],
  ["reservations", "Reservations", CalendarDays],
  ["rooms", "Rooms & availability", BedDouble],
  ["inventory", "Supplies & inventory", Boxes],
  ["operations", "Room prep & maintenance", ClipboardCheck],
  ["instructions", "Team instructions", ClipboardList],
  ["booking", "Booking engine", Globe2],
  ["assistant", "AI assistant", Bot]
];

const seedStock = [
  { id: 1, item: "Bath towels", category: "Linen", stock: 86, par: 72, unit: "pcs", cost: 8.5, supplier: "Coastal Textile" },
  { id: 2, item: "Queen bed sheets", category: "Linen", stock: 34, par: 42, unit: "sets", cost: 18, supplier: "Coastal Textile" },
  { id: 3, item: "Shampoo 40ml", category: "Amenities", stock: 212, par: 160, unit: "bottles", cost: 0.65, supplier: "GuestCare BD" },
  { id: 4, item: "Dental kits", category: "Amenities", stock: 78, par: 96, unit: "kits", cost: 0.9, supplier: "GuestCare BD" },
  { id: 5, item: "Laundry detergent", category: "Housekeeping", stock: 18, par: 20, unit: "litres", cost: 4.4, supplier: "CleanPro" },
  { id: 6, item: "Minibar water", category: "F&B", stock: 146, par: 120, unit: "bottles", cost: 0.35, supplier: "Fresh Supply" }
];

const seedExpenses = [
  { id: "EX-2091", date: "Sep 23", category: "Housekeeping", vendor: "CleanPro", note: "Cleaning chemicals", amount: 286, status: "Approved" },
  { id: "EX-2090", date: "Sep 23", category: "Maintenance", vendor: "CoolTech", note: "Room 207 HVAC service", amount: 165, status: "Pending" },
  { id: "EX-2089", date: "Sep 22", category: "Utilities", vendor: "Power utility", note: "Electricity allocation", amount: 1240, status: "Approved" },
  { id: "EX-2088", date: "Sep 22", category: "F&B", vendor: "Fresh Supply", note: "Breakfast + minibar restock", amount: 418, status: "Approved" },
  { id: "EX-2087", date: "Sep 21", category: "Marketing", vendor: "Ad platforms", note: "Media spend settlement", amount: 1940, status: "Approved" }
];

const seedInstructions = [
  { id: 1, from: "Owner · Maya Rahman", audience: "Property Manager", priority: "High", text: "Keep two Deluxe Kings available for tonight’s walk-ins until 8 PM.", due: "Today · 20:00", done: false },
  { id: 2, from: "Manager · Sam Rahman", audience: "Housekeeping", priority: "Normal", text: "Prioritize Room 103 turnover before the 14:30 arrival.", due: "Today · 14:00", done: false },
  { id: 3, from: "Owner · Maya Rahman", audience: "Maintenance", priority: "Normal", text: "Please send the Room 207 HVAC service note before approving the invoice.", due: "Today", done: false },
  { id: 4, from: "Manager · Nina Chowdhury", audience: "Front Desk", priority: "Normal", text: "VIP welcome pack for Ava Garcia should be at reception before 16:00.", due: "Today · 16:00", done: true }
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
  const [role, setRole] = useState(() => load("sp-role", "owner"));
  const [rooms, setRooms] = useState(() => load("sp-rooms", makeRooms()));
  const [bookings, setBookings] = useState(() => load("sp-bookings", seedBookings));
  const [activities, setActivities] = useState(() => load("sp-activities", initialActivities));
  const [rateMultiplier, setRateMultiplier] = useState(() => load("sp-rate", 1));
  const [metaPaused, setMetaPaused] = useState(() => load("sp-meta-paused", false));
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const liveIndex = useRef(0);

  useEffect(() => localStorage.setItem("sp-rooms", JSON.stringify(rooms)), [rooms]);
  useEffect(() => localStorage.setItem("sp-bookings", JSON.stringify(bookings)), [bookings]);
  useEffect(() => localStorage.setItem("sp-activities", JSON.stringify(activities)), [activities]);
  useEffect(() => localStorage.setItem("sp-rate", JSON.stringify(rateMultiplier)), [rateMultiplier]);
  useEffect(() => localStorage.setItem("sp-meta-paused", JSON.stringify(metaPaused)), [metaPaused]);
  useEffect(() => localStorage.setItem("sp-role", JSON.stringify(role)), [role]);

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(v => !v);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const nav = role === "owner" ? ownerNav : managerNav;

  const switchRole = nextRole => {
    setRole(nextRole);
    setActive("overview");
    setMobileNav(false);
    flash(nextRole === "owner" ? "Owner view enabled" : "Manager view enabled");
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
    localStorage.removeItem("sp-ad-channels");
    localStorage.removeItem("sp-campaigns");
    localStorage.removeItem("sp-stock");
    localStorage.removeItem("sp-expenses");
    localStorage.removeItem("sp-instructions");
    setActive("overview");
    flash("Demo data reset");
  };

  const pageProps = {
    rooms, setRooms, bookings, setBookings, activities, setActivities,
    rateMultiplier, setRateMultiplier, metaPaused, setMetaPaused,
    stats, pushActivity, flash, setActive, role
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
        <div className="prototype-tag">Demo workspace · reset anytime</div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileNav(v => !v)}><SlidersHorizontal size={18} /></button>
        <button className="search search-button" onClick={() => { setCommandQuery(""); setCommandOpen(true); }}><Search size={17} /><span>Jump to a workspace or action...</span><kbd>⌘ K</kbd></button>
        <div className="top-actions">
          <div className="live-pill"><span /> Demo environment</div>
          <div className="role-demo"><small>View as</small><div className="role-switch" aria-label="Demo role switch">
            <button className={role === "owner" ? "active" : ""} onClick={() => switchRole("owner")}><WalletCards size={14} /> Owner</button>
            <button className={role === "manager" ? "active" : ""} onClick={() => switchRole("manager")}><UserCog size={14} /> Manager</button>
          </div></div>
          <button className="icon-btn"><Bell size={18} /><i /></button>
          <div className="avatar">{role === "owner" ? "MR" : "SR"}</div>
          <div className="profile"><b>{role === "owner" ? "Maya Rahman" : "Sam Rahman"}</b><span>{role === "owner" ? "Owner" : "Property Manager"}</span></div>
          <ChevronDown size={16} />
        </div>
      </header>

      <div className="content">
        {active === "overview" && <Overview {...pageProps} />}
        {active === "reservations" && <Reservations {...pageProps} />}
        {active === "rooms" && <Rooms {...pageProps} />}
        {active === "inventory" && <Inventory {...pageProps} />}
        {active === "expenses" && role === "owner" && <Expenses {...pageProps} />}
        {active === "channels" && <Channels {...pageProps} />}
        {active === "marketing" && <Marketing {...pageProps} />}
        {active === "operations" && <Operations {...pageProps} />}
        {active === "instructions" && <Instructions {...pageProps} />}
        {active === "booking" && <BookingEngine {...pageProps} />}
        {active === "assistant" && <Assistant {...pageProps} />}
        {active === "connections" && <Connections {...pageProps} />}
      </div>
    </main>

    {commandOpen && <div className="command-backdrop" onMouseDown={() => setCommandOpen(false)}>
      <div className="command-palette" onMouseDown={e => e.stopPropagation()}>
        <div className="command-search"><Search size={18} /><input autoFocus value={commandQuery} onChange={e => setCommandQuery(e.target.value)} placeholder="Search workspaces..." /><kbd>ESC</kbd></div>
        <div className="command-label">Workspaces</div>
        <div className="command-grid">
          {nav.filter(([, label]) => label.toLowerCase().includes(commandQuery.toLowerCase())).map(([id, label, Icon]) => <button key={id} onClick={() => { setActive(id); setCommandOpen(false); setCommandQuery(""); }}>
            <span><Icon size={17} /></span><div><b>{label}</b><small>{id === "assistant" ? "Operate hotel actions with natural language" : id === "booking" ? "Create a live demo reservation" : "Open " + label.toLowerCase()}</small></div><ArrowUpRight size={14} />
          </button>)}
        </div>
        <div className="command-tip"><Sparkles size={14} /> Use the role switch to preview owner-level business controls or manager-level property operations.</div>
      </div>
    </div>}
    {notice && <div className="toast"><CheckCircle2 size={18} />{notice}<button onClick={() => setNotice("")}><X size={14} /></button></div>}
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
  </div>;
}

function Overview({ stats, activities, setActive, role, rooms }) {
  const owner = role === "owner";
  const attentionRooms = rooms.filter(r => ["Cleaning", "Maintenance"].includes(r.status));
  const readyRooms = rooms.filter(r => r.status === "Available").length;
  const currentStock = load("sp-stock", seedStock);
  const currentExpenses = load("sp-expenses", seedExpenses);
  const currentInstructions = load("sp-instructions", seedInstructions);
  const expensesToday = currentExpenses.filter(e => e.date === "Sep 23").reduce((a, e) => a + Number(e.amount || 0), 0);
  const lowStock = currentStock.filter(i => i.stock < i.par).length;
  const ownerKpis = [
    ["Occupancy", stats.occupancy + "%", "+6.8%", TrendingUp, "vs. last week"],
    ["Gross revenue", fmt(stats.revenue), "+12.4%", DollarSign, "today"],
    ["Operating expenses", fmt(expensesToday), "2 entries", ReceiptText, "logged today"],
    ["Est. operating margin", "68%", "+3.1 pts", WalletCards, "room revenue basis"]
  ];
  const managerKpis = [
    ["Arrivals today", String(stats.arrivals), "Next 14:30", Users, "front desk queue"],
    ["Rooms ready", String(readyRooms), "Live", CheckCircle2, "available to sell"],
    ["Needs attention", String(attentionRooms.length), "Action", Wrench, "cleaning + maintenance"],
    ["Low stock items", String(lowStock), "Review", Package, "below par level"]
  ];
  const kpis = owner ? ownerKpis : managerKpis;

  return <>
    <PageHeader
      eyebrow={owner ? "Owner workspace · Wednesday, September 23" : "Manager workspace · Wednesday, September 23"}
      title={owner ? "Business overview" : "Property operations"}
      text={owner ? "Revenue, costs, inventory exposure and property performance in one owner-level view." : "Today’s arrivals, room readiness, maintenance and staff handoff priorities."}
      action={<div className="page-actions">
        {!owner && <button className="ghost-btn" onClick={() => setActive("instructions")}><ClipboardList size={16} /> Instructions</button>}
        <button className="primary-btn" onClick={() => setActive("booking")}><Plus size={16} /> New reservation</button>
      </div>}
    />

    <section className="ops-pulse">
      <div className="ops-pulse-label"><span className="live-dot" /><div><b>{owner ? "Business pulse" : "Shift pulse"}</b><small>Live operational signals</small></div></div>
      <button onClick={() => setActive("reservations")}><span>Next arrival</span><b>14:30 · Olivia Martin</b><ArrowUpRight size={14} /></button>
      <button onClick={() => setActive("rooms")}><span>Room attention</span><b>{attentionRooms.length} active issues</b><ArrowUpRight size={14} /></button>
      <button onClick={() => setActive("inventory")}><span>Inventory</span><b>{lowStock} below par</b><ArrowUpRight size={14} /></button>
      <button className="pulse-ai" onClick={() => setActive("assistant")}><Sparkles size={15} /><span><b>Ask StayPilot AI</b><small>Operate the property</small></span></button>
    </section>

    <section className="kpi-grid">
      {kpis.map(([label, value, trend, Icon, sub]) => <article className="kpi-card" key={label}>
        <div className="kpi-top"><span>{label}</span><div className="kpi-icon"><Icon size={18} /></div></div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-meta"><b>{trend}</b><span>{sub}</span></div>
      </article>)}
    </section>

    {owner ? <>
      <section className="owner-field-grid">
        <button className="panel owner-field" onClick={() => setActive("expenses")}><span className="field-icon"><ReceiptText size={19} /></span><div><span>Month-to-date OpEx</span><b>$18,640</b><small>72% of monthly budget</small></div><ArrowUpRight size={15} /></button>
        <button className="panel owner-field" onClick={() => setActive("inventory")}><span className="field-icon"><Boxes size={19} /></span><div><span>Supply inventory value</span><b>$3,870</b><small>{lowStock} items need reorder</small></div><ArrowUpRight size={15} /></button>
        <button className="panel owner-field" onClick={() => setActive("channels")}><span className="field-icon"><RefreshCw size={19} /></span><div><span>OTA exposure</span><b>62%</b><small>38% direct share</small></div><ArrowUpRight size={15} /></button>
        <button className="panel owner-field" onClick={() => setActive("marketing")}><span className="field-icon"><Megaphone size={19} /></span><div><span>Paid acquisition</span><b>5.67x</b><small>blended ROAS</small></div><ArrowUpRight size={15} /></button>
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-head"><div><span className="panel-kicker">Performance</span><h3>Revenue & booking pace</h3></div><button className="ghost-btn">Last 7 days <ChevronDown size={14} /></button></div>
          <div className="chart-stat"><b>$58,950</b><span><TrendingUp size={13} /> 14.2% vs previous period</span></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b8cff" stopOpacity={0.36} /><stop offset="100%" stopColor="#5b8cff" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#e8edf5" vertical={false} /><XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fill: "#78859a", fontSize: 12 }} /><YAxis hide />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4eaf2", boxShadow: "0 10px 30px rgba(20,35,60,.12)" }} formatter={v => [fmt(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#356df3" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <ActivityPanel activities={activities} setActive={setActive} />
      </section>

      <section className="bottom-grid">
        <article className="panel channel-panel">
          <div className="panel-head"><div><span className="panel-kicker">Distribution</span><h3>Booking channel mix</h3></div><button className="icon-btn flat"><MoreHorizontal size={18} /></button></div>
          <div className="bar-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={channelData} barSize={24}><CartesianGrid stroke="#edf1f7" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#78859a", fontSize: 11 }} /><YAxis hide /><Tooltip cursor={{ fill: "#f5f7fb" }} contentStyle={{ borderRadius: 12, border: "1px solid #e4eaf2" }} formatter={v => [v + "%", "Share"]} /><Bar dataKey="value" fill="#5b8cff" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </article>
        <article className="panel snapshot">
          <div className="panel-head"><div><span className="panel-kicker">Owner metrics</span><h3>Property snapshot</h3></div></div>
          <div className="snapshot-grid"><div><span>ADR</span><b>{fmt(stats.adr)}</b><small>+4.8%</small></div><div><span>RevPAR</span><b>{fmt(stats.revpar)}</b><small>+9.2%</small></div><div><span>Direct share</span><b>38%</b><small>+7 pts</small></div><div><span>Guest rating</span><b>4.8</b><small>218 reviews</small></div></div>
          <div className="goal"><div><span>Direct booking goal</span><b>76%</b></div><div className="progress"><i style={{ width: "76%" }} /></div><p>19 bookings away from this month’s target.</p></div>
        </article>
      </section>
    </> : <>
      <section className="manager-grid">
        <article className="panel manager-readiness">
          <div className="panel-head"><div><span className="panel-kicker">Room readiness</span><h3>Today’s preparation board</h3></div><button className="ghost-btn" onClick={() => setActive("rooms")}>Open room board</button></div>
          <div className="readiness-list">
            {rooms.filter(r => ["Cleaning", "Maintenance", "Reserved"].includes(r.status)).slice(0, 6).map(r => <div key={r.number}><span className={"room-dot " + r.status.toLowerCase()} /><div><b>Room {r.number}</b><small>{r.type}</small></div><StatusDot status={r.status} /></div>)}
          </div>
        </article>
        <article className="panel manager-instructions">
          <div className="panel-head"><div><span className="panel-kicker">Handoff</span><h3>Instructions for your shift</h3></div><button className="ghost-btn" onClick={() => setActive("instructions")}>View all</button></div>
          <div className="instruction-preview">{currentInstructions.filter(i => !i.done).slice(0, 3).map(i => <div key={i.id}><span className={"priority-mark " + i.priority.toLowerCase()} /><div><b>{i.text}</b><small>{i.from} · {i.due}</small></div></div>)}</div>
        </article>
      </section>
      <section className="dashboard-grid manager-activity-grid">
        <ActivityPanel activities={activities} setActive={setActive} />
        <article className="panel shift-summary">
          <div className="panel-head"><div><span className="panel-kicker">Shift controls</span><h3>What needs action</h3></div></div>
          <div className="shift-actions">
            <button onClick={() => setActive("operations")}><Wrench size={18} /><div><b>Maintenance</b><span>1 open room issue</span></div><ArrowUpRight size={15} /></button>
            <button onClick={() => setActive("inventory")}><Package size={18} /><div><b>Supplies</b><span>{lowStock} below par</span></div><ArrowUpRight size={15} /></button>
            <button onClick={() => setActive("reservations")}><CalendarDays size={18} /><div><b>Arrivals</b><span>{stats.arrivals} expected today</span></div><ArrowUpRight size={15} /></button>
          </div>
        </article>
      </section>
    </>}
  </>;
}

function ActivityPanel({ activities, setActive }) {
  return <article className="panel activity-panel">
    <div className="panel-head"><div><span className="panel-kicker">Live operations</span><h3>Activity stream</h3></div><span className="live-label"><i /> updating</span></div>
    <div className="activity-list">{activities.slice(0, 5).map(a => <div className="activity-item" key={a.id}><span className={"activity-icon " + a.tone}><Wifi size={14} /></span><div><b>{a.title}</b><span>{a.meta}</span></div><time>{a.time}</time></div>)}</div>
    <button className="text-btn" onClick={() => setActive("operations")}>View operations <ArrowUpRight size={14} /></button>
  </article>;
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

function Inventory({ role, pushActivity, flash }) {
  const [stock, setStock] = useState(() => load("sp-stock", seedStock));
  useEffect(() => localStorage.setItem("sp-stock", JSON.stringify(stock)), [stock]);

  const low = stock.filter(i => i.stock < i.par);
  const value = stock.reduce((a, i) => a + i.stock * i.cost, 0);
  const adjust = (id, delta) => {
    setStock(prev => prev.map(i => i.id === id ? { ...i, stock: Math.max(0, i.stock + delta) } : i));
  };
  const reorder = item => {
    const qty = Math.max(item.par - item.stock, Math.ceil(item.par * .35));
    setStock(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock + qty } : i));
    pushActivity("green", "Inventory restock received", item.item + " · +" + qty + " " + item.unit);
    flash(item.item + " restocked by " + qty);
  };

  return <>
    <PageHeader
      eyebrow="Property supplies"
      title="Supplies & inventory"
      text={role === "owner" ? "Track stock value, par levels, suppliers and operating inventory across the property." : "Keep housekeeping, amenities and guest supplies above operational par levels."}
      action={<button className="primary-btn" onClick={() => flash("Purchase order draft created")}><Plus size={16} /> New purchase order</button>}
    />

    <section className="inventory-summary">
      <article className="kpi-card"><div className="kpi-top"><span>Tracked items</span><Boxes size={18} /></div><div className="kpi-value">{stock.length}</div><div className="kpi-meta"><b>{stock.length - low.length} healthy</b><span>active SKUs</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Below par</span><Bell size={18} /></div><div className="kpi-value">{low.length}</div><div className="kpi-meta"><b>Needs action</b><span>reorder suggested</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Inventory value</span><WalletCards size={18} /></div><div className="kpi-value">{role === "owner" ? fmt(Math.round(value)) : "—"}</div><div className="kpi-meta"><b>{role === "owner" ? "At cost" : "Owner only"}</b><span>{role === "owner" ? "current stock" : "financial value hidden"}</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Suppliers</span><Package size={18} /></div><div className="kpi-value">{new Set(stock.map(i => i.supplier)).size}</div><div className="kpi-meta"><b>Active</b><span>property vendors</span></div></article>
    </section>

    <article className="panel table-panel inventory-table-panel">
      <div className="panel-head"><div><span className="panel-kicker">Stock control</span><h3>Operational inventory</h3></div><span className="live-label"><i /> local demo state</span></div>
      <div className="table-scroll"><table className="inventory-table"><thead><tr><th>Item</th><th>Category</th><th>On hand</th><th>Par level</th><th>Health</th>{role === "owner" && <><th>Unit cost</th><th>Stock value</th></>}<th>Supplier</th><th /></tr></thead><tbody>
        {stock.map(item => {
          const lowItem = item.stock < item.par;
          return <tr key={item.id}>
            <td><b>{item.item}</b><small>{item.unit}</small></td>
            <td>{item.category}</td>
            <td><div className="stock-stepper"><button onClick={() => adjust(item.id, -1)}>−</button><b>{item.stock}</b><button onClick={() => adjust(item.id, 1)}>+</button></div></td>
            <td>{item.par}</td>
            <td><span className={"stock-health " + (lowItem ? "low" : "good")}><i />{lowItem ? "Below par" : "Healthy"}</span></td>
            {role === "owner" && <><td>{fmt(item.cost)}</td><td><b>{fmt(Math.round(item.stock * item.cost))}</b></td></>}
            <td>{item.supplier}</td>
            <td>{lowItem ? <button className="row-action" onClick={() => reorder(item)}>Reorder</button> : <button className="icon-btn flat"><MoreHorizontal size={17} /></button>}</td>
          </tr>;
        })}
      </tbody></table></div>
    </article>
  </>;
}

function Expenses({ pushActivity, flash }) {
  const [expenses, setExpenses] = useState(() => load("sp-expenses", seedExpenses));
  const [form, setForm] = useState({ category: "Housekeeping", vendor: "", note: "", amount: "" });
  useEffect(() => localStorage.setItem("sp-expenses", JSON.stringify(expenses)), [expenses]);

  const total = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const pending = expenses.filter(e => e.status === "Pending");
  const budget = 26000;
  const addExpense = e => {
    e.preventDefault();
    if (!form.vendor.trim() || !Number(form.amount)) return flash("Add vendor and amount");
    const row = { id: "EX-" + (2100 + expenses.length), date: "Sep 23", ...form, amount: Number(form.amount), status: "Pending" };
    setExpenses(prev => [row, ...prev]);
    setForm({ category: "Housekeeping", vendor: "", note: "", amount: "" });
    pushActivity("amber", "Expense submitted for approval", row.vendor + " · " + fmt(row.amount));
    flash("Expense added as pending");
  };
  const approve = id => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: "Approved" } : e));
    flash("Expense approved");
  };

  return <>
    <PageHeader eyebrow="Owner finance" title="Operating expenses" text="Track property spending, approvals and budget consumption alongside hotel revenue." action={<button className="ghost-btn" onClick={() => flash("Expense report exported")}><ArrowUpRight size={16} /> Export report</button>} />
    <section className="expense-summary">
      <article className="kpi-card"><div className="kpi-top"><span>Month-to-date</span><ReceiptText size={18} /></div><div className="kpi-value">{fmt(total)}</div><div className="kpi-meta"><b>{Math.round(total / budget * 100)}%</b><span>of operating budget</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Budget remaining</span><WalletCards size={18} /></div><div className="kpi-value">{fmt(Math.max(0, budget - total))}</div><div className="kpi-meta"><b>{fmt(budget)}</b><span>monthly budget</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Pending approval</span><Clock3 size={18} /></div><div className="kpi-value">{pending.length}</div><div className="kpi-meta"><b>{fmt(pending.reduce((a,e)=>a+e.amount,0))}</b><span>awaiting owner</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Largest category</span><BarChart3 size={18} /></div><div className="kpi-value">Marketing</div><div className="kpi-meta"><b>$1,940</b><span>current period</span></div></article>
    </section>

    <section className="expense-layout">
      <article className="panel table-panel">
        <div className="panel-head"><div><span className="panel-kicker">Ledger</span><h3>Recent expenses</h3></div></div>
        <div className="table-scroll"><table><thead><tr><th>ID</th><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>
          {expenses.map(e => <tr key={e.id}><td><b>{e.id}</b></td><td>{e.date}</td><td>{e.category}</td><td><b>{e.vendor}</b></td><td>{e.note}</td><td><b>{fmt(e.amount)}</b></td><td><StatusDot status={e.status} /></td><td>{e.status === "Pending" && <button className="row-action" onClick={() => approve(e.id)}>Approve</button>}</td></tr>)}
        </tbody></table></div>
      </article>
      <aside className="panel expense-form">
        <span className="panel-kicker">New entry</span><h3>Add operating expense</h3><p>Manager-submitted costs would arrive here for owner approval.</p>
        <form onSubmit={addExpense}>
          <label>Category<select value={form.category} onChange={e => setForm({...form,category:e.target.value})}><option>Housekeeping</option><option>Maintenance</option><option>Utilities</option><option>F&B</option><option>Marketing</option><option>Payroll</option></select></label>
          <label>Vendor<input value={form.vendor} onChange={e => setForm({...form,vendor:e.target.value})} placeholder="Vendor or supplier" /></label>
          <label>Description<input value={form.note} onChange={e => setForm({...form,note:e.target.value})} placeholder="What was purchased?" /></label>
          <label>Amount<div className="modal-money"><span>$</span><input type="number" min="1" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} placeholder="0" /></div></label>
          <button className="primary-btn" type="submit"><Plus size={15} /> Add expense</button>
        </form>
      </aside>
    </section>
  </>;
}

function Instructions({ role, pushActivity, flash }) {
  const [items, setItems] = useState(() => load("sp-instructions", seedInstructions));
  const [draft, setDraft] = useState({ audience: role === "owner" ? "Property Manager" : "Housekeeping", priority: "Normal", text: "", due: "Today" });
  useEffect(() => localStorage.setItem("sp-instructions", JSON.stringify(items)), [items]);
  useEffect(() => setDraft(d => ({ ...d, audience: role === "owner" ? "Property Manager" : "Housekeeping" })), [role]);

  const addInstruction = e => {
    e.preventDefault();
    if (!draft.text.trim()) return flash("Add an instruction first");
    const from = role === "owner" ? "Owner · Maya Rahman" : "Manager · Sam Rahman";
    const item = { id: Date.now(), from, ...draft, text: draft.text.trim(), done: false };
    setItems(prev => [item, ...prev]);
    setDraft(d => ({ ...d, text: "" }));
    pushActivity("blue", "Team instruction posted", draft.audience + " · " + draft.text.trim());
    flash("Instruction shared");
  };
  const toggleDone = id => setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));

  return <>
    <PageHeader eyebrow="Team coordination" title="Instructions & handoff" text={role === "owner" ? "Issue property instructions and review manager handoff notes in one shared thread." : "See owner and manager instructions for the shift, then leave clear handoff notes for the team."} />
    <section className="instruction-layout">
      <article className="panel instruction-board">
        <div className="panel-head"><div><span className="panel-kicker">Shared board</span><h3>Active instructions</h3></div><span className="instruction-count">{items.filter(i=>!i.done).length} open</span></div>
        <div className="instruction-list">
          {items.map(i => <div className={"instruction-item " + (i.done ? "done" : "")} key={i.id}>
            <button className={"instruction-check " + (i.done ? "checked" : "")} onClick={() => toggleDone(i.id)}>{i.done && <Check size={13} />}</button>
            <div className="instruction-main"><div className="instruction-meta"><span>{i.from}</span><em className={i.priority.toLowerCase()}>{i.priority}</em></div><b>{i.text}</b><small>For {i.audience} · {i.due}</small></div>
          </div>)}
        </div>
      </article>
      <aside className="panel instruction-compose">
        <span className="panel-kicker">{role === "owner" ? "Owner instruction" : "Manager handoff"}</span><h3>{role === "owner" ? "Send an instruction" : "Leave a team note"}</h3><p>{role === "owner" ? "Assign priorities to the manager or operating teams." : "Share operational context with housekeeping, maintenance, front desk or other managers."}</p>
        <form onSubmit={addInstruction}>
          <label>Send to<select value={draft.audience} onChange={e=>setDraft({...draft,audience:e.target.value})}>{role === "owner" && <option>Property Manager</option>}<option>Housekeeping</option><option>Maintenance</option><option>Front Desk</option><option>All Managers</option></select></label>
          <label>Priority<select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value})}><option>Normal</option><option>High</option></select></label>
          <label>Due<select value={draft.due} onChange={e=>setDraft({...draft,due:e.target.value})}><option>Today</option><option>Before next arrival</option><option>End of shift</option><option>Tomorrow morning</option></select></label>
          <label>Instruction<textarea value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})} placeholder={role === "owner" ? "What should the team handle?" : "Leave a clear handoff note..."} /></label>
          <button className="primary-btn" type="submit"><Send size={15} /> Share instruction</button>
        </form>
      </aside>
    </section>
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
    <div className="mini-note"><MessageSquare size={15} /> Provider access is configured under Connections & API. Inventory remains centralized here after credentials are approved.</div>
  </>;
}

function Marketing({ metaPaused, setMetaPaused, pushActivity, flash, setActive }) {
  const [adChannels, setAdChannels] = useState(() => {
    const saved = load("sp-ad-channels", seedAdChannels);
    return saved.map(c => c.id === "meta" ? { ...c, enabled: !metaPaused } : c);
  });
  const [campaignRows, setCampaignRows] = useState(() => load("sp-campaigns", seedCampaigns));
  const [networkFilter, setNetworkFilter] = useState("All");
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", network: "Google Hotel Ads", type: "Direct bookings", budget: 75 });
  useEffect(() => localStorage.setItem("sp-ad-channels", JSON.stringify(adChannels)), [adChannels]);
  useEffect(() => localStorage.setItem("sp-campaigns", JSON.stringify(campaignRows)), [campaignRows]);

  const totals = useMemo(() => {
    const spend = campaignRows.reduce((a, c) => a + c.spend, 0);
    const revenue = campaignRows.reduce((a, c) => a + c.revenue, 0);
    const bookings = campaignRows.reduce((a, c) => a + c.bookings, 0);
    return { spend, revenue, bookings, roas: spend ? revenue / spend : 0, cpa: bookings ? spend / bookings : 0 };
  }, [campaignRows]);

  const updateChannel = (id, patch) => {
    setAdChannels(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const toggleChannel = channel => {
    const enabled = !channel.enabled;
    updateChannel(channel.id, { enabled });
    if (channel.id === "meta") setMetaPaused(!enabled);
    pushActivity(channel.tone === "violet" ? "violet" : "blue", channel.name + " delivery " + (enabled ? "enabled" : "paused"), "Changed from Marketing control center");
    flash(channel.name + (enabled ? " enabled" : " paused"));
  };

  const changeBudget = (channel, value) => {
    const budget = Math.max(0, Math.min(2000, Number(value) || 0));
    updateChannel(channel.id, { budget });
  };

  const saveChannel = channel => {
    pushActivity("blue", channel.name + " controls updated", "$" + channel.budget + "/day · target " + channel.roasTarget + "x ROAS");
    flash(channel.name + " controls saved");
  };

  const toggleCampaign = campaign => {
    const next = campaign.status === "Active" ? "Paused" : "Active";
    setCampaignRows(prev => prev.map(c => c.id === campaign.id ? { ...c, status: next } : c));
    pushActivity("violet", campaign.name + " " + next.toLowerCase(), campaign.network + " · campaign control");
    flash(campaign.name + " " + next.toLowerCase());
  };

  const updateCampaignBudget = (id, value) => {
    const budget = Math.max(0, Math.min(2000, Number(value) || 0));
    setCampaignRows(prev => prev.map(c => c.id === id ? { ...c, budget } : c));
  };

  const createCampaign = e => {
    e.preventDefault();
    if (!newCampaign.name.trim()) return flash("Add a campaign name");
    const row = {
      id: "cmp-" + Date.now(),
      name: newCampaign.name.trim(),
      network: newCampaign.network,
      type: newCampaign.type,
      spend: 0,
      budget: Math.max(1, Number(newCampaign.budget) || 1),
      bookings: 0,
      revenue: 0,
      roas: 0,
      status: "Active"
    };
    setCampaignRows(prev => [row, ...prev]);
    pushActivity("green", "Campaign created", row.network + " · $" + row.budget + "/day · " + row.name);
    setNewCampaign({ name: "", network: "Google Hotel Ads", type: "Direct bookings", budget: 75 });
    setNewCampaignOpen(false);
    flash("Campaign created");
  };

  const networks = ["All", ...Array.from(new Set(campaignRows.map(c => c.network)))];
  const visibleCampaigns = networkFilter === "All" ? campaignRows : campaignRows.filter(c => c.network === networkFilter);

  return <>
    <PageHeader
      eyebrow="Growth"
      title="Marketing control center"
      text="Control acquisition channels, budgets and campaign delivery against real booking revenue."
      action={<div className="page-actions"><button className="ghost-btn" onClick={() => setActive("connections")}><PlugZap size={16} /> Connections</button><button className="primary-btn" onClick={() => setNewCampaignOpen(true)}><Plus size={16} /> New campaign</button></div>}
    />

    <section className="kpi-grid marketing-kpis">
      <article className="kpi-card"><div className="kpi-top"><span>Attributed revenue</span><BarChart3 size={18} /></div><div className="kpi-value">{fmt(totals.revenue)}</div><div className="kpi-meta"><b>+18.7%</b><span>vs. previous 30 days</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Ad spend</span><DollarSign size={18} /></div><div className="kpi-value">{fmt(totals.spend)}</div><div className="kpi-meta"><b>{totals.roas.toFixed(2)}x</b><span>blended ROAS</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Cost per booking</span><TrendingUp size={18} /></div><div className="kpi-value">{fmt(Math.round(totals.cpa))}</div><div className="kpi-meta"><b>{totals.bookings}</b><span>attributed bookings</span></div></article>
      <article className="kpi-card"><div className="kpi-top"><span>Attribution health</span><ShieldCheck size={18} /></div><div className="kpi-value">97.8%</div><div className="kpi-meta"><b>Healthy</b><span>booking events matched</span></div></article>
    </section>

    <section className="marketing-control-section">
      <div className="section-title-row"><div><span className="panel-kicker">Channel control</span><h2>Media delivery & budget</h2><p>Pause channels, change daily caps and set the ROAS guardrail used by automation.</p></div><span className="architecture-badge"><Wifi size={14} /> 5 networks reporting</span></div>
      <div className="ad-channel-grid">
        {adChannels.map(channel => <article className={"panel ad-channel-card " + (!channel.enabled ? "disabled" : "")} key={channel.id}>
          <div className="ad-channel-head">
            <span className={"provider-logo " + channel.tone}>{channel.short}</span>
            <div><b>{channel.name}</b><span>{channel.detail}</span></div>
            <button className={"toggle-switch " + (channel.enabled ? "on" : "")} onClick={() => toggleChannel(channel)} aria-label={(channel.enabled ? "Pause " : "Enable ") + channel.name}><i /></button>
          </div>
          <div className="ad-channel-performance">
            <div><span>Spend</span><b>{fmt(channel.spend)}</b></div>
            <div><span>Revenue</span><b>{fmt(channel.revenue)}</b></div>
            <div><span>Bookings</span><b>{channel.bookings}</b></div>
            <div><span>ROAS</span><b>{(channel.revenue / channel.spend).toFixed(1)}x</b></div>
          </div>
          <div className="ad-controls">
            <label><span>Daily budget</span><div className="money-input"><span>$</span><input type="number" min="0" max="2000" value={channel.budget} onChange={e => changeBudget(channel, e.target.value)} /></div></label>
            <label><span>Target ROAS</span><div className="money-input"><input type="number" min="1" max="20" step="0.1" value={channel.roasTarget} onChange={e => updateChannel(channel.id, { roasTarget: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /><span>x</span></div></label>
          </div>
          <div className="ad-channel-foot"><span><i className={channel.enabled ? "green-dot" : "gray-dot"} />{channel.enabled ? "Delivering" : "Paused"}</span><button onClick={() => saveChannel(channel)}>Save controls</button></div>
        </article>)}
      </div>
    </section>

    <section className="marketing-ops-grid">
      <article className="panel campaign-panel">
        <div className="panel-head campaign-head"><div><span className="panel-kicker">Campaigns</span><h3>Revenue-connected campaigns</h3></div><div className="campaign-filter"><select value={networkFilter} onChange={e => setNetworkFilter(e.target.value)}>{networks.map(n => <option key={n}>{n}</option>)}</select></div></div>
        <div className="table-scroll"><table className="campaign-table"><thead><tr><th>Campaign</th><th>Network</th><th>Daily budget</th><th>Spend</th><th>Bookings</th><th>Revenue</th><th>ROAS</th><th>Status</th><th /></tr></thead><tbody>
          {visibleCampaigns.map(c => <tr key={c.id}>
            <td><b>{c.name}</b><small>{c.type}</small></td>
            <td><span className={"source source-" + c.network.toLowerCase().replaceAll(" ","-").replace("/","-")}>{c.network}</span></td>
            <td><div className="table-budget"><span>$</span><input type="number" min="0" max="2000" value={c.budget} onChange={e => updateCampaignBudget(c.id, e.target.value)} /></div></td>
            <td>{fmt(c.spend)}</td><td>{c.bookings}</td><td><b>{fmt(c.revenue)}</b></td><td><b>{c.roas}x</b></td><td><StatusDot status={c.status} /></td>
            <td><button className="row-action" onClick={() => toggleCampaign(c)}>{c.status === "Active" ? "Pause" : "Resume"}</button></td>
          </tr>)}
        </tbody></table></div>
      </article>

      <aside className="panel attribution-panel">
        <div className="panel-head"><div><span className="panel-kicker">Attribution</span><h3>Conversion pipeline</h3></div><StatusDot status="Live" /></div>
        <div className="attribution-list">
          <div><span className="attr-icon"><Globe2 size={17} /></span><div><b>Website booking events</b><span>Browser + server events</span></div><strong>Healthy</strong></div>
          <div><span className="attr-icon"><RefreshCw size={17} /></span><div><b>Offline conversion sync</b><span>Booking revenue → ad networks</span></div><strong>4 min</strong></div>
          <div><span className="attr-icon"><CheckCircle2 size={17} /></span><div><b>UTM / click ID capture</b><span>gclid · fbclid · ttclid · msclkid</span></div><strong>97.8%</strong></div>
          <div><span className="attr-icon"><ShieldCheck size={17} /></span><div><b>Consent gate</b><span>Only approved marketing events forwarded</span></div><strong>On</strong></div>
        </div>
        <button className="secondary-btn full-control" onClick={() => { pushActivity("blue", "Marketing attribution resynced", "Booking events reconciled across ad networks"); flash("Attribution sync completed"); }}><RefreshCw size={15} /> Reconcile conversions</button>
      </aside>
    </section>

    {newCampaignOpen && <div className="marketing-modal-backdrop" onMouseDown={() => setNewCampaignOpen(false)}>
      <form className="marketing-modal panel" onSubmit={createCampaign} onMouseDown={e => e.stopPropagation()}>
        <div className="marketing-modal-head"><div><span className="panel-kicker">Campaign control</span><h2>Create campaign</h2><p>Add a campaign to the unified control surface. Delivery remains a demo until provider credentials are connected.</p></div><button type="button" className="icon-btn" onClick={() => setNewCampaignOpen(false)}><X size={17} /></button></div>
        <div className="campaign-form-grid">
          <label>Campaign name<input value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} placeholder="e.g. Winter direct booking" /></label>
          <label>Ad network<select value={newCampaign.network} onChange={e => setNewCampaign({ ...newCampaign, network: e.target.value })}><option>Google Hotel Ads</option><option>Google Search</option><option>Meta</option><option>TikTok</option><option>Microsoft Ads</option></select></label>
          <label>Objective<select value={newCampaign.type} onChange={e => setNewCampaign({ ...newCampaign, type: e.target.value })}><option>Direct bookings</option><option>Retargeting</option><option>Brand search</option><option>Prospecting</option><option>Metasearch</option></select></label>
          <label>Daily budget<div className="modal-money"><span>$</span><input type="number" min="1" max="2000" value={newCampaign.budget} onChange={e => setNewCampaign({ ...newCampaign, budget: e.target.value })} /></div></label>
        </div>
        <div className="marketing-modal-actions"><button type="button" className="ghost-btn" onClick={() => setNewCampaignOpen(false)}>Cancel</button><button className="primary-btn" type="submit"><Plus size={15} /> Create campaign</button></div>
      </form>
    </div>}
  </>;
}

function Operations({ activities, role, pushActivity, flash, setActive }) {
  const [tasks, setTasks] = useState([
    { id: 1, place: "Room 103", title: "Full turnover", team: "Housekeeping", due: "Due 14:15", status: "In progress" },
    { id: 2, place: "Room 207", title: "HVAC inspection", team: "Maintenance", due: "Due 15:00", status: "Assigned" },
    { id: 3, place: "Lobby", title: "Welcome setup — VIP", team: "Front desk", due: "Due 16:00", status: "Queued" },
    { id: 4, place: "Room 108", title: "Extra towels requested", team: "Housekeeping", due: "Due 16:20", status: "New" }
  ]);
  const payments = [
    ["SP-1046", "Ava Garcia", "Direct Website", 1180, "Captured"],
    ["SP-1048", "Olivia Martin", "Booking.com", 684, "Secured"],
    ["SP-1043", "Ethan Lee", "Direct Website", 612, "Captured"]
  ];
  const complete = task => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "Completed" } : t));
    pushActivity("green", task.place + " task completed", task.team + " · " + task.title);
    flash(task.place + " marked complete");
  };

  return <>
    <PageHeader
      eyebrow={role === "manager" ? "Manager operations" : "Property operations"}
      title={role === "manager" ? "Room prep & maintenance" : "The property command center"}
      text={role === "manager" ? "Control room preparation, housekeeping and maintenance work for the active shift." : "Housekeeping, maintenance, payments and live system events share one operational workspace."}
      action={role === "manager" ? <button className="ghost-btn" onClick={() => setActive("instructions")}><ClipboardList size={15} /> Shift instructions</button> : null}
    />
    <section className="ops-grid">
      <article className="panel">
        <div className="panel-head"><div><span className="panel-kicker">Service board</span><h3>Tasks & housekeeping</h3></div><span className="instruction-count">{tasks.filter(t=>t.status!=="Completed").length} open</span></div>
        <div className="task-list">{tasks.map(t => <div className={"task " + (t.status === "Completed" ? "task-done" : "")} key={t.id}>
          <button className={"task-check " + (t.status === "Completed" ? "checked" : "")} onClick={() => complete(t)} disabled={t.status === "Completed"}>{t.status === "Completed" && <Check size={12} />}</button>
          <div><b>{t.place} · {t.title}</b><span>{t.team} · {t.due}</span></div><em>{t.status}</em>
        </div>)}</div>
      </article>

      {role === "owner" ? <article className="panel">
        <div className="panel-head"><div><span className="panel-kicker">Payments</span><h3>Recent transactions</h3></div><CreditCard size={18} /></div>
        <div className="payment-list">{payments.map(p => <div key={p[0]}><span className="pay-icon"><CreditCard size={15} /></span><div><b>{p[1]}</b><span>{p[0]} · {p[2]}</span></div><strong>{fmt(p[3])}</strong><StatusDot status={p[4]} /></div>)}</div>
      </article> : <article className="panel maintenance-control">
        <div className="panel-head"><div><span className="panel-kicker">Maintenance</span><h3>Open property issues</h3></div><Wrench size={18} /></div>
        <div className="maintenance-list">
          <div><span className="maintenance-severity high">High</span><div><b>Room 207 · HVAC inspection</b><small>Guest comfort · technician assigned</small></div><button className="row-action" onClick={() => flash("Maintenance note opened")}>Open</button></div>
          <div><span className="maintenance-severity normal">Normal</span><div><b>Service lift · door sensor</b><small>Monitor during afternoon shift</small></div><button className="row-action" onClick={() => flash("Maintenance note opened")}>Open</button></div>
        </div>
      </article>}
    </section>

    <article className="panel ops-activity">
      <div className="panel-head"><div><span className="panel-kicker">Automation log</span><h3>Live system events</h3></div><span className="live-label"><i /> streaming</span></div>
      <div className="activity-list wide">{activities.map(a => <div className="activity-item" key={a.id}><span className={"activity-icon " + a.tone}><Wifi size={14} /></span><div><b>{a.title}</b><span>{a.meta}</span></div><time>{a.time}</time></div>)}</div>
    </article>
  </>;
}

function BookingEngine({ rooms, setRooms, bookings, setBookings, rateMultiplier, pushActivity, flash, setActive }) {
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
        {success ? <div className="booking-success"><span><CheckCircle2 size={30} /></span><h3>Reservation confirmed</h3><p>{success.guest} · Room {success.room}</p><div><b>{success.id}</b><b>{fmt(success.total)}</b></div><div className="success-actions"><button className="secondary-btn" onClick={() => setActive("reservations")}>View reservation <ArrowUpRight size={14} /></button><button className="ghost-btn" onClick={() => setActive("assistant")}><Sparkles size={14} /> Ask assistant</button></div><button className="text-link-btn" onClick={() => setSuccess(null)}>Create another booking</button></div> :
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

    const roomNumberMatch = lower.match(/room\s*#?\s*(\d+)/);
    const roomNumber = roomNumberMatch?.[1];
    const room = roomNumber ? rooms.find(r => r.number === roomNumber) : null;
    const wantsMaintenance = /\b(block|blocked|maintenance|close|closed|out of service)\b/.test(lower);
    const wantsReady = /\b(ready|available|release|released|open)\b/.test(lower);
    const wantsCleaning = /\b(cleaning|needs cleaning|dirty)\b/.test(lower);
    const rateMatch = lower.match(/(?:raise|increase).*(\d+)%/);

    if (roomNumber && !room) {
      reply = "I can’t find Room " + roomNumber + " in this property, so I didn’t change inventory.";
    } else if (room && wantsMaintenance) {
      setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, status: "Maintenance" } : r));
      pushActivity("amber", "Assistant blocked Room " + roomNumber, "Maintenance hold · inventory removed from channels");
      reply = room.status === "Maintenance"
        ? "Room " + roomNumber + " is already on maintenance hold. No change was needed."
        : "Done. Room " + roomNumber + " is now on maintenance hold and has been removed from sellable inventory.";
    } else if (room && wantsReady) {
      setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, status: "Available" } : r));
      pushActivity("green", "Assistant marked Room " + roomNumber + " ready", "Available · inventory returned to channels");
      reply = room.status === "Available"
        ? "Room " + roomNumber + " is already marked ready and available. No change was needed."
        : "Done. Room " + roomNumber + " is marked ready. Its status changed from " + room.status + " to Available and it is back in sellable inventory.";
    } else if (room && wantsCleaning) {
      setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, status: "Cleaning" } : r));
      pushActivity("amber", "Assistant sent Room " + roomNumber + " to cleaning", "Housekeeping queue · not sellable");
      reply = room.status === "Cleaning"
        ? "Room " + roomNumber + " is already in the cleaning queue."
        : "Room " + roomNumber + " is now marked Cleaning and temporarily removed from sellable inventory.";
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
        <article className="panel assistant-tip"><span><Bot size={19} /></span><h3>Action, not just answers.</h3><p>Approved commands update operational state through the same control layer used by reservations, inventory, rates and marketing.</p><button className="secondary-btn" onClick={() => setActive("rooms")}>Open room board <ArrowUpRight size={14} /></button></article>
      </aside>
    </div>
  </div>;
}

function Connections({ pushActivity, flash }) {
  const providers = {
    booking: {
      name: "Booking.com", icon: "B", tone: "blue", type: "Channel", note: "Connectivity Partner API",
      fields: [
        ["clientId", "Client ID", "bkg_live_xxxxxxxxx", "text"],
        ["clientSecret", "Client Secret", "Enter machine account secret", "secret"],
        ["propertyId", "Property ID(s)", "12345678, 87654321", "text"]
      ],
      scopes: ["Reservations", "Rates & availability", "Messaging"]
    },
    airbnb: {
      name: "Airbnb", icon: "A", tone: "coral", type: "Channel", note: "Partner access required",
      fields: [
        ["clientId", "Client ID", "Airbnb partner client ID", "text"],
        ["clientSecret", "Client Secret", "Enter partner secret", "secret"],
        ["accountId", "Account / listing group", "Account identifier", "text"]
      ],
      scopes: ["Listings", "Availability", "Reservations"]
    },
    meta: {
      name: "Meta Ads", icon: "M", tone: "violet", type: "Marketing", note: "Marketing API",
      fields: [
        ["businessId", "Business Manager ID", "123456789012345", "text"],
        ["adAccountId", "Ad Account ID", "act_1234567890", "text"],
        ["appId", "App ID", "Meta app ID", "text"],
        ["accessToken", "Access Token", "Enter system user access token", "secret"]
      ],
      scopes: ["ads_read", "ads_management", "business_management"]
    },
    stripe: {
      name: "Stripe", icon: "S", tone: "violet", type: "Payments", note: "Payments + webhooks",
      fields: [
        ["secretKey", "Restricted / Secret Key", "rk_live_... or sk_live_...", "secret"],
        ["webhookSecret", "Webhook Signing Secret", "whsec_...", "secret"],
        ["accountId", "Connected Account ID", "acct_... (optional)", "text"]
      ],
      scopes: ["Payments", "Refunds", "Webhook events"]
    },
    google: {
      name: "Google Ads", icon: "G", tone: "yellow", type: "Marketing", note: "Search, Performance Max & conversion reporting",
      fields: [
        ["customerId", "Customer ID", "123-456-7890", "text"],
        ["developerToken", "Developer Token", "Enter developer token", "secret"],
        ["clientId", "OAuth Client ID", "OAuth client ID", "text"],
        ["clientSecret", "OAuth Client Secret", "Enter OAuth secret", "secret"]
      ],
      scopes: ["Campaign reporting", "Conversions", "Budget control"]
    },
    hotelCenter: {
      name: "Google Hotel Center", icon: "H", tone: "blue", type: "Hotel advertising", note: "Hotel list, rates, availability & Hotel Ads",
      fields: [
        ["hotelCenterId", "Hotel Center Account ID", "123456789", "text"],
        ["propertyFeedId", "Property / feed ID", "Northstar property feed", "text"],
        ["googleAdsCustomerId", "Linked Google Ads Customer ID", "123-456-7890", "text"],
        ["feedToken", "Feed / integration credential", "Enter integration credential", "secret"]
      ],
      scopes: ["Hotel prices", "Availability feed", "Hotel campaign reporting"]
    },
    tiktok: {
      name: "TikTok Ads", icon: "TT", tone: "coral", type: "Marketing", note: "TikTok API for Business",
      fields: [
        ["advertiserId", "Advertiser ID", "7123456789012345678", "text"],
        ["appId", "App ID", "TikTok developer app ID", "text"],
        ["appSecret", "App Secret", "Enter app secret", "secret"],
        ["accessToken", "Access Token", "Enter authorized access token", "secret"]
      ],
      scopes: ["Campaign management", "Reporting", "Conversion events"]
    },
    microsoft: {
      name: "Microsoft Ads", icon: "MS", tone: "green", type: "Marketing", note: "Search, audience & lodging campaigns",
      fields: [
        ["accountId", "Account ID", "123456789", "text"],
        ["customerId", "Customer ID", "987654321", "text"],
        ["developerToken", "Developer Token", "Enter developer token", "secret"],
        ["refreshToken", "OAuth Refresh Token", "Enter OAuth refresh token", "secret"]
      ],
      scopes: ["Campaign management", "Reporting", "Lodging campaigns"]
    },
    mail: {
      name: "Guest Messaging", icon: "@", tone: "green", type: "Communications", note: "Email / messaging provider",
      fields: [
        ["sender", "Sender Address", "stay@northstar.example", "text"],
        ["apiKey", "Provider API Key", "Enter messaging API key", "secret"],
        ["replyTo", "Reply-to Address", "frontdesk@northstar.example", "text"]
      ],
      scopes: ["Booking confirmations", "Pre-arrival", "Post-stay"]
    }
  };
  const [selected, setSelected] = useState("booking");
  const [environment, setEnvironment] = useState("Sandbox");
  const [values, setValues] = useState({});
  const [revealed, setRevealed] = useState({});
  const [connected, setConnected] = useState({ stripe: true });
  const [testing, setTesting] = useState(false);
  const provider = providers[selected];
  const webhook = "https://api.staypilot.demo/webhooks/" + selected;

  const updateValue = (key, value) => setValues(prev => ({ ...prev, [selected + "." + key]: value }));
  const getValue = key => values[selected + "." + key] || "";

  const testConnection = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setConnected(prev => ({ ...prev, [selected]: true }));
      pushActivity("green", provider.name + " connection verified", environment + " credentials · health check passed");
      flash(provider.name + " connection test passed");
    }, 750);
  };

  const save = () => {
    pushActivity("blue", provider.name + " configuration staged", "Demo only · production secrets belong in server vault");
    flash("Configuration staged for secure server-side storage");
  };

  const copyWebhook = async () => {
    try { await navigator.clipboard.writeText(webhook); flash("Webhook URL copied"); }
    catch { flash("Webhook URL ready to copy"); }
  };

  return <>
    <PageHeader
      eyebrow="System administration"
      title="Connections & API credentials"
      text="Configure the external systems that power inventory sync, reservations, payments, marketing attribution and guest communications."
      action={<div className="connection-security"><ShieldCheck size={17} /><div><b>Secrets vault</b><span>Server-side in production</span></div></div>}
    />

    <section className="connections-summary">
      <div><span className="summary-icon"><PlugZap size={19} /></span><div><b>{Object.values(connected).filter(Boolean).length} connected</b><span>of {Object.keys(providers).length} integrations</span></div></div>
      <div><span className="summary-icon safe"><ShieldCheck size={19} /></span><div><b>Encrypted secrets</b><span>KMS / environment vault</span></div></div>
      <div><span className="summary-icon"><Database size={19} /></span><div><b>Webhook intake</b><span>Signed + idempotent events</span></div></div>
      <div className="environment-switch"><span>Environment</span><div>{["Sandbox", "Production"].map(x => <button key={x} className={environment === x ? "active" : ""} onClick={() => setEnvironment(x)}>{x}</button>)}</div></div>
    </section>

    <div className="connections-layout">
      <aside className="panel provider-list">
        <div className="provider-head"><span className="panel-kicker">Integrations</span><h3>Connected services</h3><p>Select a provider to configure credentials and event delivery.</p></div>
        {Object.entries(providers).map(([id, p]) => <button key={id} className={selected === id ? "active" : ""} onClick={() => setSelected(id)}>
          <span className={"provider-logo " + p.tone}>{p.icon}</span>
          <div><b>{p.name}</b><small>{p.type}</small></div>
          <span className={"provider-state " + (connected[id] ? "connected" : "")}><i />{connected[id] ? "Connected" : "Setup"}</span>
        </button>)}
      </aside>

      <section className="panel credential-panel">
        <div className="credential-head">
          <div className={"provider-logo large " + provider.tone}>{provider.icon}</div>
          <div><span className="panel-kicker">{provider.type}</span><h2>{provider.name}</h2><p>{provider.note}</p></div>
          <StatusDot status={connected[selected] ? "Live" : "Setup"} />
        </div>

        <div className="security-notice"><ShieldCheck size={18} /><div><b>Credential safety</b><p>This portfolio demo never persists what you type here. A production build should submit secrets over HTTPS to a backend vault/KMS and return only masked metadata to this page.</p></div></div>

        <div className="credential-grid">
          {provider.fields.map(([key, label, placeholder, kind]) => <label className="credential-field" key={key}>
            <span>{label}{kind === "secret" && <em>Secret</em>}</span>
            <div className="credential-input">
              <KeyRound size={16} />
              <input
                type={kind === "secret" && !revealed[selected + "." + key] ? "password" : "text"}
                value={getValue(key)}
                onChange={e => updateValue(key, e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
              />
              {kind === "secret" && <button type="button" onClick={() => setRevealed(prev => ({ ...prev, [selected + "." + key]: !prev[selected + "." + key] }))}>
                {revealed[selected + "." + key] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>}
            </div>
          </label>)}
        </div>

        <div className="webhook-box">
          <div><span className="panel-kicker">Inbound event endpoint</span><b>{webhook}</b><small>Use this endpoint for reservation, payment or campaign events from {provider.name}.</small></div>
          <button className="ghost-btn" onClick={copyWebhook}><Copy size={15} /> Copy URL</button>
        </div>

        <div className="scope-block"><span>Enabled capabilities</span><div>{provider.scopes.map(s => <em key={s}><Check size={13} />{s}</em>)}</div></div>

        <div className="credential-actions">
          <button className="ghost-btn test-btn" onClick={testConnection} disabled={testing}><RefreshCw size={16} className={testing ? "spin" : ""} />{testing ? "Testing connection..." : "Test connection"}</button>
          <button className="primary-btn" onClick={save}><ShieldCheck size={16} /> Save securely</button>
        </div>
      </section>
    </div>

    <section className="connection-health panel">
      <div className="panel-head"><div><span className="panel-kicker">Runtime health</span><h3>Credential & event delivery</h3></div><button className="ghost-btn" onClick={() => flash("All connection health checks queued")}><RefreshCw size={15} /> Test all</button></div>
      <div className="connection-health-grid">
        <div><span className="health-icon green"><CheckCircle2 size={17} /></span><div><b>Webhook receiver</b><small>Signed events · no failures</small></div><strong>Healthy</strong></div>
        <div><span className="health-icon blue"><KeyRound size={17} /></span><div><b>Token renewal</b><small>Next scheduled check in 41 min</small></div><strong>Automatic</strong></div>
        <div><span className="health-icon violet"><RefreshCw size={17} /></span><div><b>Conversion export</b><small>Last batch reconciled 4 min ago</small></div><strong>Current</strong></div>
        <div><span className="health-icon amber"><Bell size={17} /></span><div><b>Failure policy</b><small>3 retries → operator alert</small></div><strong>Enabled</strong></div>
      </div>
    </section>
  </>;
}

export default App;
