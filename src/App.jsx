import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, CalendarDays, BedDouble, RefreshCw, Megaphone,
  ClipboardCheck, Globe2, Bot, Bell, Search, ChevronDown, TrendingUp,
  Users, DollarSign, ArrowUpRight, MoreHorizontal, CheckCircle2,
  Clock3, Wrench, Send, Plus, CreditCard, Wifi, RotateCcw, X,
  SlidersHorizontal, Building2, Moon, UserRound, ExternalLink,
  MessageSquare, Sparkles, BarChart3, Home, Settings2, KeyRound,
  Eye, EyeOff, ShieldCheck, PlugZap, Copy, Check, Database, Zap,
  Package, ReceiptText, ClipboardList, Boxes, UserCog, WalletCards, Play
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

const normalizeRoom = room => {
  if (room.occupancy && room.housekeeping && room.maintenance) return room;
  const legacy = room.status || "Available";
  return {
    ...room,
    occupancy: legacy === "Occupied" ? "Occupied" : legacy === "Reserved" ? "Reserved" : "Vacant",
    housekeeping: legacy === "Cleaning" ? "Cleaning" : "Clean",
    maintenance: legacy === "Maintenance" ? "Out of order" : "Clear"
  };
};

const roomSellable = room => room.occupancy === "Vacant" && room.housekeeping === "Clean" && room.maintenance === "Clear";
const roomPrimaryStatus = room => {
  if (room.maintenance !== "Clear") return "Maintenance";
  if (room.housekeeping !== "Clean") return room.housekeeping;
  if (room.occupancy === "Vacant") return "Available";
  return room.occupancy;
};

const makeRooms = () => Array.from({ length: 24 }, (_, i) => {
  const floor = i < 12 ? 1 : 2;
  const number = String(floor * 100 + (i % 12) + 1);
  const type = i % 6 === 0 ? "Sky Suite" : i % 2 === 0 ? "Deluxe King" : "City Queen";
  const preset = {
    "204": { occupancy: "Reserved", housekeeping: "Clean", maintenance: "Clear" },
    "108": { occupancy: "Occupied", housekeeping: "Clean", maintenance: "Clear" },
    "211": { occupancy: "Reserved", housekeeping: "Clean", maintenance: "Clear" },
    "105": { occupancy: "Reserved", housekeeping: "Clean", maintenance: "Clear" },
    "202": { occupancy: "Reserved", housekeeping: "Clean", maintenance: "Clear" },
    "110": { occupancy: "Reserved", housekeeping: "Clean", maintenance: "Clear" },
    "103": { occupancy: "Vacant", housekeeping: "Cleaning", maintenance: "Clear" },
    "207": { occupancy: "Vacant", housekeeping: "Clean", maintenance: "Out of order" }
  };
  return {
    number,
    type,
    ...(preset[number] || { occupancy: i % 5 === 0 ? "Occupied" : "Vacant", housekeeping: "Clean", maintenance: "Clear" })
  };
});

const initialActivities = [
  { id: 1, tone: "blue", title: "Booking.com reservation synced", meta: "SP-1048 · Deluxe King · $684", time: "2 min ago", actor: "StayPilot system", category: "System" },
  { id: 2, tone: "green", title: "Direct payment captured", meta: "Visa •••• 4482 · $1,180", time: "6 min ago", actor: "StayPilot system", category: "Operations" },
  { id: 3, tone: "violet", title: "Meta Ads conversion attributed", meta: "Weekend Escape · ROAS 6.2x", time: "11 min ago", actor: "StayPilot automation", category: "Automation" },
  { id: 4, tone: "amber", title: "Room 103 moved to cleaning", meta: "Housekeeping · priority normal", time: "18 min ago", actor: "Sam Rahman · Property Manager", category: "Operations" }
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
  ["overview", "Owner dashboard", LayoutDashboard, "Property"],
  ["frontdesk", "Front desk calendar", CalendarDays, "Property"],
  ["reservations", "Reservations", ClipboardCheck, "Property"],
  ["exceptions", "Exceptions", Bell, "Property"],
  ["inbox", "Guest inbox", MessageSquare, "Property"],
  ["rooms", "Rooms & availability", BedDouble, "Property"],
  ["operations", "Operations", ClipboardCheck, "Property"],
  ["instructions", "Team instructions", ClipboardList, "Property"],
  ["booking", "Booking engine", Globe2, "Property"],
  ["inventory", "Supplies & inventory", Boxes, "Business"],
  ["approvals", "Approval center", ShieldCheck, "Business"],
  ["expenses", "Expenses", ReceiptText, "Business"],
  ["channels", "Channel manager", RefreshCw, "Business"],
  ["marketing", "Marketing", Megaphone, "Business"],
  ["automations", "Automation center", Zap, "Automation"],
  ["audit", "Audit log", Clock3, "Automation"],
  ["permissions", "Roles & permissions", ShieldCheck, "Automation"],
  ["assistant", "Operations assistant", Bot, "Automation"],
  ["connections", "Integration hub", Settings2, "Platform"],
  ["setup", "Property setup", ClipboardList, "Platform"]
];

const managerNav = [
  ["overview", "Manager dashboard", LayoutDashboard, "Property"],
  ["frontdesk", "Front desk calendar", CalendarDays, "Property"],
  ["reservations", "Reservations", ClipboardCheck, "Property"],
  ["exceptions", "Exceptions", Bell, "Property"],
  ["inbox", "Guest inbox", MessageSquare, "Property"],
  ["rooms", "Rooms & availability", BedDouble, "Property"],
  ["operations", "Room prep & maintenance", ClipboardCheck, "Property"],
  ["instructions", "Team instructions", ClipboardList, "Property"],
  ["inventory", "Supplies & inventory", Boxes, "Resources"],
  ["approvals", "My requests", ShieldCheck, "Resources"],
  ["automations", "Automation center", Zap, "Automation"],
  ["audit", "Audit log", Clock3, "Automation"],
  ["assistant", "Operations assistant", Bot, "Automation"]
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

const seedApprovals = [
  { id: "APR-104", type: "Maintenance", title: "Room 207 HVAC invoice", detail: "CoolTech · diagnostic + service", amount: 165, requestedBy: "Sam Rahman", status: "Pending", time: "11 min ago" },
  { id: "APR-103", type: "Purchase order", title: "Queen bed sheet restock", detail: "20 sets · Coastal Textile", amount: 360, itemRef: 2, qty: 20, requestedBy: "Sam Rahman", status: "Pending", time: "34 min ago" },
  { id: "APR-102", type: "Rate change", title: "Weekend BAR +18%", detail: "Fri–Sat · occupancy pacing", amount: null, requestedBy: "Sam Rahman", status: "Pending", time: "1 hr ago" },
  { id: "APR-101", type: "Refund", title: "SP-1039 partial refund", detail: "Service recovery · late room readiness", amount: 85, requestedBy: "Nina Chowdhury", status: "Approved", time: "Yesterday" }
];

const seedTasks = [
  { id: 1, place: "Room 103", title: "Full turnover", team: "Housekeeping", due: "Due 14:15", status: "In progress" },
  { id: 2, place: "Room 207", title: "HVAC inspection", team: "Maintenance", due: "Due 15:00", status: "Assigned" },
  { id: 3, place: "Lobby", title: "Welcome setup — VIP", team: "Front desk", due: "Due 16:00", status: "Queued" },
  { id: 4, place: "Room 108", title: "Extra towels requested", team: "Housekeeping", due: "Due 16:20", status: "New" }
];

const seedSystemExceptions = [
  { id:"EXC-03", type:"Payment", severity:"High", title:"Payment retry exhausted", detail:"SP-1042 · Visa authorization failed twice", route:"reservations", status:"Open" },
  { id:"EXC-04", type:"Distribution", severity:"Normal", title:"Agoda acknowledgement delayed", detail:"Inventory push waiting 94 seconds", route:"channels", status:"Open" }
];

const seedAutomationRules = [
  { id: "AUTO-01", name: "Reservation intake", scope: "Operations", event: "reservation.created", trigger: "Reservation received", action: "Hold inventory → reconcile channels → confirmation", status: "Active", autonomy: "Auto", last: "2 min ago", runs: 184, failures: 0, minutesSaved: 552 },
  { id: "AUTO-02", name: "Checkout turnover", scope: "Operations", event: "guest.checked_out", trigger: "Guest checked out", action: "Room → Dirty → housekeeping task → sellability update", status: "Active", autonomy: "Auto", last: "18 min ago", runs: 42, failures: 0, minutesSaved: 168 },
  { id: "AUTO-03", name: "Pre-arrival message", scope: "Operations", event: "prearrival.due", trigger: "24h before arrival", action: "Send arrival instructions → track delivery", status: "Active", autonomy: "Auto", last: "42 min ago", runs: 67, failures: 1, minutesSaved: 134 },
  { id: "AUTO-04", name: "Occupancy rate guard", scope: "Revenue", event: "occupancy.threshold", trigger: "Occupancy > 80%", action: "BAR +8% → policy check → apply or approve", status: "Active", autonomy: "Policy", last: "1 hr ago", runs: 12, failures: 0, minutesSaved: 36 },
  { id: "AUTO-05", name: "Failed payment recovery", scope: "Finance", event: "payment.failed", trigger: "Payment authorization fails", action: "Model retry → flag folio → create exception", status: "Paused", autonomy: "Auto", last: "Yesterday", runs: 9, failures: 1, minutesSaved: 27 },
  { id: "AUTO-06", name: "Low-stock replenishment", scope: "Operations", event: "inventory.low_stock", trigger: "Item falls below par", action: "Calculate reorder → policy check → PO / approval", status: "Active", autonomy: "Policy", last: "Yesterday", runs: 8, failures: 0, minutesSaved: 32 },
  { id: "AUTO-07", name: "Cancellation recovery", scope: "Operations", event: "reservation.cancelled", trigger: "Reservation cancelled", action: "Release room/inventory → reconcile channels → resale", status: "Active", autonomy: "Auto", last: "Not run", runs: 0, failures: 0, minutesSaved: 0 },
  { id: "AUTO-08", name: "Room-ready release", scope: "Operations", event: "housekeeping.completed", trigger: "Housekeeping marks room ready", action: "Set Clean → recalculate sellability → channel release", status: "Active", autonomy: "Auto", last: "Not run", runs: 0, failures: 0, minutesSaved: 0 },
  { id: "AUTO-09", name: "Room conflict guard", scope: "Operations", event: "room.maintenance_blocked", trigger: "Assigned room goes out of order", action: "Find affected stay → alternatives → exception", status: "Active", autonomy: "Approval", last: "Not run", runs: 0, failures: 0, minutesSaved: 0 },
  { id: "AUTO-10", name: "Guest request router", scope: "Operations", event: "guest.request_received", trigger: "Guest service request received", action: "Classify → create task → route team", status: "Active", autonomy: "Auto", last: "Not run", runs: 0, failures: 0, minutesSaved: 0 },
  { id: "AUTO-11", name: "Approval executor", scope: "Governance", event: "approval.approved", trigger: "Owner approves an action", action: "Execute approved action → close handoff → audit", status: "Active", autonomy: "Auto", last: "Not run", runs: 0, failures: 0, minutesSaved: 0 },
  { id: "AUTO-12", name: "Review recovery", scope: "Guest experience", event: "review.negative", trigger: "Low guest feedback detected", action: "Create service-recovery exception → notify manager", status: "Active", autonomy: "Approval", last: "Not run", runs: 0, failures: 0, minutesSaved: 0 }
];

const seedAutomationLogs = [
  { id: 1, runId: "RUN-2818", ruleId: "AUTO-01", rule: "Reservation intake", event: "reservation.created", result: "Success", detail: "SP-1048 · Booking.com", steps: ["Inventory held", "Channel reconciliation recorded", "Confirmation recorded"], duration: 412, minutesSaved: 3, time: "2 min ago" },
  { id: 2, runId: "RUN-2817", ruleId: "AUTO-03", rule: "Pre-arrival message", event: "prearrival.due", result: "Success", detail: "Olivia Martin · delivery recorded", steps: ["Arrival detected", "Instructions sent", "Delivery tracked"], duration: 286, minutesSaved: 2, time: "42 min ago" },
  { id: 3, runId: "RUN-2816", ruleId: "AUTO-04", rule: "Occupancy rate guard", event: "occupancy.threshold", result: "Approval", detail: "APR-102 · BAR +18%", steps: ["Threshold crossed", "Policy checked", "Owner approval requested"], duration: 191, minutesSaved: 3, time: "1 hr ago" },
  { id: 4, runId: "RUN-2815", ruleId: "AUTO-05", rule: "Failed payment recovery", event: "payment.failed", result: "Failed", detail: "Retry exhausted · operator alerted", steps: ["Authorization failed", "Retry modeled", "Exception raised"], duration: 734, minutesSaved: 3, time: "Yesterday" }
];

const defaultPolicy = {
  managerCanManageRooms: true,
  managerCanSyncChannels: true,
  managerCanManageInventory: true,
  managerCanGuestMessage: true,
  managerCanOperateAutomations: true,
  managerCanMarketing: false,
  managerRateLimit: 10,
  managerRefundLimit: 100,
  managerPurchaseLimit: 150
};

const frontDeskDays = ["Sep 23", "Sep 24", "Sep 25", "Sep 26", "Sep 27", "Sep 28", "Sep 29"];
const dateIndex = value => value === "Today" ? 0 : frontDeskDays.indexOf(value);

const fmt = n => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};

const loadAutomationRules = () => {
  const saved = load("sp-automations", []);
  return seedAutomationRules.map(seed => ({ ...seed, ...(saved.find(rule => rule.id === seed.id) || {}) }));
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
  const [rooms, setRooms] = useState(() => load("sp-rooms", makeRooms()).map(normalizeRoom));
  const [bookings, setBookings] = useState(() => load("sp-bookings", seedBookings));
  const [approvals, setApprovals] = useState(() => load("sp-approvals", seedApprovals));
  const [tasks, setTasks] = useState(() => load("sp-tasks", seedTasks));
  const [stock, setStock] = useState(() => load("sp-stock", seedStock));
  const [automationRules, setAutomationRules] = useState(loadAutomationRules);
  const [automationLogs, setAutomationLogs] = useState(() => load("sp-automation-log", seedAutomationLogs));
  const [automationMaster, setAutomationMaster] = useState(() => load("sp-automation-master", "Active"));
  const [automationQueue, setAutomationQueue] = useState(() => load("sp-automation-queue", []));
  const [policy, setPolicy] = useState(() => load("sp-policy", defaultPolicy));
  const [activities, setActivities] = useState(() => load("sp-activities", initialActivities));
  const [rateMultiplier, setRateMultiplier] = useState(() => load("sp-rate", 1));
  const [metaPaused, setMetaPaused] = useState(() => load("sp-meta-paused", false));
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const liveIndex = useRef(0);
  const lowStockSeen = useRef(new Set(load("sp-lowstock-auto", [])));
  const inboundEventIds = useRef(new Set(load("sp-event-ids", [])));

  useEffect(() => localStorage.setItem("sp-rooms", JSON.stringify(rooms)), [rooms]);
  useEffect(() => localStorage.setItem("sp-bookings", JSON.stringify(bookings)), [bookings]);
  useEffect(() => localStorage.setItem("sp-approvals", JSON.stringify(approvals)), [approvals]);
  useEffect(() => localStorage.setItem("sp-tasks", JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem("sp-stock", JSON.stringify(stock)), [stock]);
  useEffect(() => localStorage.setItem("sp-automations", JSON.stringify(automationRules)), [automationRules]);
  useEffect(() => localStorage.setItem("sp-automation-log", JSON.stringify(automationLogs)), [automationLogs]);
  useEffect(() => localStorage.setItem("sp-automation-master", JSON.stringify(automationMaster)), [automationMaster]);
  useEffect(() => localStorage.setItem("sp-automation-queue", JSON.stringify(automationQueue)), [automationQueue]);
  useEffect(() => localStorage.setItem("sp-policy", JSON.stringify(policy)), [policy]);
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
      setActivities(prev => [{ id: Date.now(), tone: item[0], title: item[1], meta: item[2], time: "just now", actor: "StayPilot automation", category: "System" }, ...prev].slice(0, 40));
    }, 11000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const occupied = rooms.filter(r => r.occupancy === "Occupied").length;
    const occupancy = Math.round((occupied / rooms.length) * 100);
    const bookingRevenue = bookings.filter(b => b.status !== "Cancelled").reduce((a, b) => a + Number(b.total || 0), 0);
    return {
      occupancy,
      available: rooms.filter(roomSellable).length,
      arrivals: bookings.filter(b => b.checkIn === "Today" && !["Cancelled", "Checked out"].includes(b.status)).length,
      revenue: 18420 + bookingRevenue,
      adr: Math.round(182 * rateMultiplier),
      revpar: Math.round(153 * rateMultiplier)
    };
  }, [rooms, bookings, rateMultiplier]);

  const pushActivity = (tone, title, meta, category = "Operations", actorOverride = null) => {
    const actor = actorOverride || (role === "owner" ? "Maya Rahman · Owner" : "Sam Rahman · Property Manager");
    setActivities(prev => [{ id: Date.now(), tone, title, meta, time: "just now", actor, category }, ...prev].slice(0, 40));
  };

  const flash = text => {
    setNotice(text);
    setTimeout(() => setNotice(""), 2600);
  };

  const automationRuleFor = event => automationRules.find(rule => rule.event === event);

  const recordAutomation = (ruleId, result, detail, steps = [], minutesSaved = 0) => {
    const rule = automationRules.find(r => r.id === ruleId);
    if (!rule) return;
    const entry = {
      id: Date.now(),
      runId: "RUN-" + String(Date.now()).slice(-6),
      ruleId,
      rule: rule.name,
      event: rule.event,
      result,
      detail,
      steps,
      duration: 140 + (Date.now() % 620),
      minutesSaved,
      time: "now"
    };
    setAutomationLogs(prev => [entry, ...prev].slice(0, 60));
    setAutomationRules(prev => prev.map(r => r.id === ruleId ? {
      ...r,
      last: "now",
      runs: Number(r.runs || 0) + 1,
      failures: Number(r.failures || 0) + (result === "Failed" ? 1 : 0),
      minutesSaved: Number(r.minutesSaved || 0) + Number(minutesSaved || 0)
    } : r));
    pushActivity(
      result === "Failed" ? "amber" : result === "Approval" ? "blue" : "green",
      rule.name + " · " + result.toLowerCase(),
      detail,
      "Automation",
      "StayPilot automation"
    );
  };

  const upsertSystemException = issue => {
    const current = load("sp-exceptions", seedSystemExceptions);
    if (current.some(x => x.id === issue.id && x.status === "Open")) return;
    localStorage.setItem("sp-exceptions", JSON.stringify([issue, ...current].slice(0, 30)));
  };

  const emitHotelEvent = (event, payload = {}) => {
    const rule = payload.ruleId ? automationRules.find(r => r.id === payload.ruleId) : automationRuleFor(event);
    if (!rule) return { ok: false, reason: "No automation is mapped to " + event };
    const eventId = payload.eventId || null;
    if (eventId && inboundEventIds.current.has(eventId)) {
      return { ok: true, duplicate: true, eventId, reason: "Duplicate event suppressed" };
    }
    if (rule.status !== "Active") {
      if (payload.manual) flash(rule.name + " is paused");
      return { ok: false, reason: "Automation paused" };
    }
    if (automationMaster === "Paused") {
      if (payload.manual) {
        flash("Automation master pause is active");
        return { ok: false, reason: "Automation master pause is active" };
      }
      if (payload.stateTrigger) return { ok: false, deferred: true, reason: "Automation paused · state trigger deferred" };
      const queueKey = eventId || (event + ":" + (payload.booking?.id || payload.item?.id || payload.roomNumber || payload.request || payload.adjustment || payload.guest || "default"));
      const duplicateQueued = automationQueue.some(item => item.key === queueKey);
      if (!duplicateQueued) {
        setAutomationQueue(prev => [...prev, { id:Date.now(), key:queueKey, event, payload:{ ...payload, manual:false }, time:"now" }].slice(-30));
      }
      return { ok: false, queued: true, duplicate: duplicateQueued, eventId, reason: duplicateQueued ? "Duplicate event already queued" : "Automation paused · event queued" };
    }

    if (eventId) {
      inboundEventIds.current.add(eventId);
      localStorage.setItem("sp-event-ids", JSON.stringify(Array.from(inboundEventIds.current).slice(-120)));
    }

    if (event === "reservation.created") {
      const booking = payload.booking || bookings[0];
      if (!booking) return { ok: false, reason: "No reservation available" };
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, automationState: "Inventory held · confirmation recorded", channelSync: "Reconciled" } : b));
      recordAutomation(rule.id, "Success", booking.id + " · " + booking.source, ["Room-type inventory held", "Channel inventory reconciliation recorded", "Guest confirmation recorded", "Arrival workflow created"], 3);
      return { ok: true };
    }

    if (event === "guest.checked_out") {
      const booking = payload.booking || bookings.find(b => b.status === "Checked out") || bookings.find(b => b.room && b.room !== "Unassigned");
      const roomNumber = payload.roomNumber || booking?.room || rooms.find(r => r.occupancy === "Vacant" && r.housekeeping !== "Clean")?.number || "103";
      setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, occupancy: "Vacant", housekeeping: "Dirty" } : r));
      setTasks(prev => {
        const exists = prev.some(t => t.place === "Room " + roomNumber && t.title === "Checkout turnover" && t.status !== "Done");
        if (exists) return prev;
        return [{ id: Date.now(), place: "Room " + roomNumber, title: "Checkout turnover", team: "Housekeeping", due: "Before next arrival", status: "New", automated: true }, ...prev];
      });
      recordAutomation(rule.id, "Success", (booking?.id || "Turnover") + " · Room " + roomNumber, ["Occupancy set Vacant", "Housekeeping set Dirty", "Turnover task created", "Sellability recalculated"], 4);
      return { ok: true };
    }

    if (event === "prearrival.due") {
      const booking = payload.booking || bookings.find(b => b.status === "Confirmed") || bookings[0];
      if (!booking) return { ok: false, reason: "No upcoming arrival available" };
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, preArrivalStatus: "Sent", preArrivalAt: "now" } : b));
      recordAutomation(rule.id, "Success", booking.guest + " · " + booking.id, ["Upcoming arrival detected", "Arrival instructions generated", "Delivery recorded", "Reply tracking opened"], 2);
      return { ok: true };
    }

    if (event === "occupancy.threshold") {
      const adjustment = Number(payload.adjustment || 8);
      const policyLimit = Number(policy.managerRateLimit || 0);
      if (rule.autonomy === "Suggest") {
        recordAutomation(rule.id, "Success", "BAR +" + adjustment + "% suggested", ["Occupancy threshold evaluated", "Rate recommendation generated"], 2);
        return { ok: true };
      }
      if (rule.autonomy === "Approval" || (rule.autonomy === "Policy" && adjustment > policyLimit)) {
        const title = "Automation BAR +" + adjustment + "%";
        const existing = approvals.find(a => a.status === "Pending" && a.type === "Rate change" && a.title === title);
        if (!existing) {
          const item = { id: "APR-" + (105 + approvals.length), type: "Rate change", title, detail: "Occupancy threshold · automation policy", amount: null, requestedBy: "StayPilot automation", status: "Pending", time: "just now" };
          setApprovals(prev => [item, ...prev]);
          recordAutomation(rule.id, "Approval", item.id + " · BAR +" + adjustment + "%", ["Occupancy threshold crossed", "Rate recommendation generated", "Authority policy checked", "Owner approval requested"], 3);
        } else {
          recordAutomation(rule.id, "Approval", existing.id + " · already awaiting Owner", ["Threshold crossed", "Existing approval reused"], 1);
        }
      } else {
        setRateMultiplier(v => Number((v * (1 + adjustment / 100)).toFixed(3)));
        recordAutomation(rule.id, "Success", "BAR +" + adjustment + "% applied within policy", ["Occupancy threshold crossed", "Policy checked", "Rate adjustment applied", "Channel rate synchronization recorded"], 3);
      }
      return { ok: true };
    }

    if (event === "payment.failed") {
      const booking = payload.booking || bookings.find(b => b.status === "Confirmed") || bookings[0];
      if (!booking) return { ok: false, reason: "No reservation available" };
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, paymentRisk: "Retry exhausted" } : b));
      upsertSystemException({ id: "PAY-" + booking.id, type: "Payment", severity: "High", title: "Payment retry exhausted", detail: booking.id + " · " + booking.guest + " · authorization failed twice", route: "reservations", status: "Open" });
      recordAutomation(rule.id, "Failed", booking.id + " · retry exhausted · exception raised", ["Authorization failure received", "Processor retry modeled", "Folio flagged payment-at-risk", "Front desk exception created"], 3);
      return { ok: true };
    }

    if (event === "inventory.low_stock") {
      const item = payload.item || stock.find(i => i.stock < i.par && !approvals.some(a => a.type === "Purchase order" && a.itemRef === i.id && ["Pending", "Approved"].includes(a.status)));
      if (!item) {
        recordAutomation(rule.id, "Success", "No unhandled low-stock item", ["Par levels checked", "No new purchase action required"], 1);
        return { ok: true };
      }
      const qty = Math.max(item.par - item.stock, Math.ceil(item.par * .35));
      const amount = Number((qty * item.cost).toFixed(2));
      const requiresApproval = rule.autonomy === "Approval" || (rule.autonomy === "Policy" && amount > Number(policy.managerPurchaseLimit || 0));
      const status = requiresApproval ? "Pending" : "Approved";
      const order = {
        id: "APR-AUTO-" + item.id + "-" + String(Date.now()).slice(-4),
        type: "Purchase order",
        title: item.item + " automated restock",
        detail: qty + " " + item.unit + " · " + item.supplier,
        amount, itemRef: item.id, qty,
        requestedBy: "StayPilot automation",
        status,
        time: "just now"
      };
      setApprovals(prev => [order, ...prev]);
      recordAutomation(rule.id, requiresApproval ? "Approval" : "Success", order.id + " · " + item.item + " · " + fmt(amount), ["Below-par condition detected", "Reorder quantity calculated", "Spend policy checked", requiresApproval ? "Owner approval requested" : "Purchase order approved within policy"], 4);
      return { ok: true };
    }

    if (event === "reservation.cancelled") {
      const booking = payload.booking || bookings.find(b => b.status === "Cancelled") || bookings[0];
      if (!booking) return { ok: false, reason: "No reservation available" };
      if (booking.room && booking.room !== "Unassigned") setRooms(prev => prev.map(r => r.number === booking.room ? { ...r, occupancy: "Vacant" } : r));
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, channelSync: "Inventory released" } : b));
      recordAutomation(rule.id, "Success", booking.id + " · inventory released", ["Cancellation received", "Room hold released", "Room-type inventory recalculated", "Channel reconciliation recorded", "Resale availability restored"], 4);
      return { ok: true };
    }

    if (event === "housekeeping.completed") {
      const roomNumber = payload.roomNumber || rooms.find(r => r.housekeeping !== "Clean" && r.maintenance === "Clear")?.number || "103";
      setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, housekeeping: "Clean" } : r));
      setTasks(prev => prev.map(t => t.place === "Room " + roomNumber && t.team === "Housekeeping" && t.status !== "Done" ? { ...t, status: "Done" } : t));
      const target = rooms.find(r => r.number === roomNumber);
      const sellable = target ? target.occupancy === "Vacant" && target.maintenance === "Clear" : true;
      recordAutomation(rule.id, "Success", "Room " + roomNumber + (sellable ? " · returned to sellable inventory" : " · readiness updated"), ["Housekeeping completion received", "Room marked Clean", "Open housekeeping task closed", "Sellability recalculated", "Channel availability reconciliation recorded"], 3);
      return { ok: true };
    }

    if (event === "room.maintenance_blocked") {
      const roomNumber = payload.roomNumber || rooms.find(r => r.maintenance !== "Clear")?.number || "207";
      const affected = payload.booking || bookings.find(b => b.room === roomNumber && !["Cancelled", "Checked out"].includes(b.status));
      const targetRoom = rooms.find(r => r.number === roomNumber);
      const alternatives = rooms.filter(r => r.number !== roomNumber && r.type === (affected?.type || targetRoom?.type) && roomSellable(r)).slice(0, 3);
      const detail = affected
        ? affected.id + " · " + affected.guest + " affected · alternatives: " + (alternatives.map(r => r.number).join(", ") || "none ready")
        : "Room " + roomNumber + " blocked · no active reservation conflict";
      if (affected) upsertSystemException({ id:"CONFLICT-"+affected.id, type:"Room conflict", severity:"High", title:"Room "+roomNumber+" conflict for "+affected.guest, detail, route:"frontdesk", status:"Open", suggestedRooms: alternatives.map(r => r.number) });
      recordAutomation(rule.id, affected ? "Approval" : "Success", detail, ["Maintenance block received", "Reservation conflict checked", "Compatible rooms searched", affected ? "Manager exception created" : "No guest move required"], 5);
      return { ok: true };
    }

    if (event === "guest.request_received") {
      const booking = payload.booking || bookings.find(b => b.status === "Checked in") || bookings[0];
      const roomNumber = payload.roomNumber || booking?.room || "108";
      const request = payload.request || "Extra towels requested";
      setTasks(prev => {
        const exists = prev.some(t => t.place === "Room " + roomNumber && t.title === request && t.status !== "Done");
        return exists ? prev : [{ id:Date.now(), place:"Room "+roomNumber, title:request, team:"Housekeeping", due:"Guest request · respond within 15 min", status:"New", automated:true }, ...prev];
      });
      recordAutomation(rule.id, "Success", (booking?.guest || "Guest") + " · Room " + roomNumber + " · " + request, ["Guest request classified", "Housekeeping route selected", "Service task created", "Response SLA started"], 3);
      return { ok: true };
    }

    if (event === "approval.approved") {
      const item = payload.item || approvals.find(a => a.status === "Approved");
      if (!item) return { ok:false, reason:"No approved action available" };
      recordAutomation(rule.id, "Success", item.id + " · " + item.title, ["Owner approval received", item.type + " action released", "Operational handoff closed", "Audit trail recorded"], 2);
      return { ok:true };
    }

    if (event === "review.negative") {
      const guest = payload.guest || "Recent guest";
      const score = payload.score || 2;
      upsertSystemException({ id:"REV-"+String(Date.now()).slice(-6), type:"Guest recovery", severity:"High", title:score+"★ feedback needs follow-up", detail:guest+" · cleanliness/service concern · manager response requested", route:"inbox", status:"Open" });
      recordAutomation(rule.id, "Approval", guest + " · " + score + "★ review", ["Negative feedback detected", "Service-recovery case created", "Manager follow-up requested"], 4);
      return { ok:true };
    }

    return { ok: false, reason: "Unsupported automation event" };
  };

  useEffect(() => {
    if (automationMaster !== "Active" || !automationQueue.length) return;
    const pending = [...automationQueue];
    setAutomationQueue([]);
    pending.forEach(item => emitHotelEvent(item.event, { ...item.payload, replayFromQueue:true }));
    pushActivity("green", "Queued automation events released", pending.length + " event" + (pending.length === 1 ? "" : "s") + " replayed after Owner resume", "Automation", "StayPilot automation");
  }, [automationMaster]);

  useEffect(() => {
    const seen = lowStockSeen.current;
    let changed = false;
    stock.filter(item => item.stock < item.par).forEach(item => {
      const openOrder = approvals.some(a => a.type === "Purchase order" && a.itemRef === item.id && ["Pending", "Approved"].includes(a.status));
      if (openOrder || seen.has(item.id)) return;
      const result = emitHotelEvent("inventory.low_stock", { item, stateTrigger:true });
      if (result?.ok) {
        seen.add(item.id);
        changed = true;
      }
    });
    if (changed) localStorage.setItem("sp-lowstock-auto", JSON.stringify(Array.from(seen)));
  }, [stock, automationMaster]);

  useEffect(() => {
    if (stats.occupancy < 80) return;
    if (load("sp-occupancy-auto-fired", false)) return;
    const result = emitHotelEvent("occupancy.threshold", { adjustment: 8, stateTrigger:true });
    if (result?.ok) localStorage.setItem("sp-occupancy-auto-fired", JSON.stringify(true));
  }, [stats.occupancy, automationMaster]);

  useEffect(() => {
    if (load("sp-prearrival-auto-fired", false)) return;
    const upcoming = bookings.find(b => b.checkIn === "Sep 24" && b.status === "Confirmed" && b.preArrivalStatus !== "Sent");
    if (!upcoming) return;
    const result = emitHotelEvent("prearrival.due", { booking: upcoming, stateTrigger:true });
    if (result?.ok) localStorage.setItem("sp-prearrival-auto-fired", JSON.stringify(true));
  }, [bookings, automationMaster]);

  const nav = role === "owner" ? ownerNav : managerNav;

  const switchRole = nextRole => {
    setRole(nextRole);
    setActive("overview");
    setMobileNav(false);
    flash(nextRole === "owner" ? "Owner view enabled" : "Manager view enabled");
  };

  const applyScenario = scenario => {
    if (scenario === "normal") {
      const booking = { id:"SP-DEMO-01", guest:"Emma Brooks", paid:96, room:"Unassigned", type:"Deluxe King", source:"Booking.com", checkIn:"Today", checkOut:"Sep 26", guests:2, total:480, status:"Confirmed" };
      setBookings(prev => [booking, ...prev.filter(b => b.id !== booking.id)]);
      const result = emitHotelEvent("reservation.created", { booking });
      setActive("frontdesk");
      flash(result?.ok ? "Normal-day scenario loaded · reservation automation executed" : result?.queued ? "Normal-day scenario loaded · reservation automation queued" : result?.reason || "Normal-day scenario loaded");
      return;
    }
    if (scenario === "problem") {
      const booking = bookings.find(b => b.room === "204") || bookings[0];
      setRooms(prev => prev.map(r => r.number === "204" ? { ...r, maintenance:"Out of order" } : r));
      const result = emitHotelEvent("room.maintenance_blocked", { roomNumber:"204", booking });
      setActive(result?.queued ? "automations" : "exceptions");
      flash(result?.ok ? "Problem-day scenario loaded · room conflict automation executed" : result?.queued ? "Problem-day scenario loaded · room conflict automation queued" : result?.reason || "Problem-day scenario loaded");
      return;
    }
    if (scenario === "approval") {
      const result = emitHotelEvent("occupancy.threshold", { adjustment:14 });
      setRole("owner");
      setActive(result?.queued ? "automations" : "approvals");
      flash(result?.ok ? "Approval scenario loaded · pricing request escalated to Owner" : result?.queued ? "Approval scenario loaded · pricing event queued" : result?.reason || "Approval scenario loaded");
    }
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
    localStorage.removeItem("sp-approvals");
    localStorage.removeItem("sp-tasks");
    localStorage.removeItem("sp-guest-threads");
    localStorage.removeItem("sp-automations");
    localStorage.removeItem("sp-automation-log");
    localStorage.removeItem("sp-automation-master");
    localStorage.removeItem("sp-automation-queue");
    localStorage.removeItem("sp-exceptions");
    localStorage.removeItem("sp-webhook-endpoints");
    localStorage.removeItem("sp-webhook-deliveries");
    localStorage.removeItem("sp-property-setup");
    localStorage.removeItem("sp-routed-guest-requests");
    localStorage.removeItem("sp-policy");
    localStorage.removeItem("sp-lowstock-auto");
    localStorage.removeItem("sp-event-ids");
    localStorage.removeItem("sp-occupancy-auto-fired");
    localStorage.removeItem("sp-prearrival-auto-fired");
    lowStockSeen.current = new Set();
    inboundEventIds.current = new Set();
    setApprovals(seedApprovals);
    setTasks(seedTasks);
    setStock(seedStock);
    setAutomationRules(seedAutomationRules);
    setAutomationLogs(seedAutomationLogs);
    setAutomationMaster("Active");
    setAutomationQueue([]);
    setPolicy(defaultPolicy);
    setActive("overview");
    flash("Demo data reset");
  };

  const pageProps = {
    rooms, setRooms, bookings, setBookings, approvals, setApprovals, tasks, setTasks, stock, setStock,
    automationRules, setAutomationRules, automationLogs, setAutomationLogs, automationMaster, setAutomationMaster, automationQueue, emitHotelEvent,
    policy, setPolicy, activities, setActivities, rateMultiplier, setRateMultiplier, metaPaused, setMetaPaused,
    stats, pushActivity, flash, setActive, role
  };

  const persistedIssues = load("sp-exceptions", seedSystemExceptions).filter(x => x.status === "Open" && (role === "owner" || x.type !== "Distribution"));
  const exceptionCount =
    rooms.filter(r => r.maintenance !== "Clear").length +
    rooms.filter(r => r.occupancy === "Reserved" && r.housekeeping !== "Clean").length +
    bookings.filter(b => b.room === "Unassigned" && !["Cancelled", "Checked out"].includes(b.status)).length +
    (role === "owner" ? approvals.filter(a => a.status === "Pending").length : 0) +
    persistedIssues.length;

  return <div className="app-shell">
    <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
      <div className="brand">
        <div className="brand-mark"><Building2 size={20} /></div>
        <div><strong>StayPilot</strong><span>Automation OS</span></div>
      </div>
      <div className="property-card">
        <div className="property-thumb"><Moon size={18} /></div>
        <div><b>Northstar Grand</b><span>Chattogram · Demo</span></div>
        <ChevronDown size={16} />
      </div>
      <nav>
        {Array.from(new Set(nav.map(item => item[3]))).map(group => <div className="nav-group" key={group}>
          <div className="nav-label">{group}</div>
          {nav.filter(item => item[3] === group).map(([id, label, Icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); setMobileNav(false); }}>
            <Icon size={18} /><span>{label}</span>{id === "assistant" && <em>OPS</em>}
          </button>)}
        </div>)}
      </nav>
      <div className="sidebar-foot">
        <div className={"system-health " + (automationMaster === "Paused" ? "paused" : "")}><span className="live-dot" /><div><b>{automationMaster === "Paused" ? "Automations paused" : "Demo systems ready"}</b><span>{automationMaster === "Paused" ? automationQueue.length + " queued · Owner safety pause active" : "shared local state active"}</span></div></div>
        <div className="scenario-switcher">
          <span>Demo scenarios</span>
          <button onClick={() => applyScenario("normal")}><CheckCircle2 size={13}/> Normal</button>
          <button onClick={() => applyScenario("problem")}><Wrench size={13}/> Problem</button>
          <button onClick={() => applyScenario("approval")}><ShieldCheck size={13}/> Approval</button>
        </div>
        <button className="reset-btn" onClick={resetDemo}><RotateCcw size={15} /> Reset demo</button>
        <div className="prototype-tag">Demo workspace · reset anytime</div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileNav(v => !v)}><SlidersHorizontal size={18} /></button>
        <button className="search search-button" onClick={() => { setCommandQuery(""); setCommandOpen(true); }}><Search size={17} /><span>Jump to a workspace or action...</span><kbd>⌘ K</kbd></button>
        <div className="top-actions">
          <div className={"live-pill " + (automationMaster === "Paused" ? "paused" : "")}><span /> {automationMaster === "Paused" ? "Automation paused" : "Demo environment"}</div>
          <div className="role-demo"><small>View as</small><div className="role-switch" aria-label="Demo role switch">
            <button className={role === "owner" ? "active" : ""} onClick={() => switchRole("owner")}><WalletCards size={14} /> Owner</button>
            <button className={role === "manager" ? "active" : ""} onClick={() => switchRole("manager")}><UserCog size={14} /> Manager</button>
          </div></div>
          <button className="icon-btn exception-button" onClick={() => setActive("exceptions")} aria-label={"Open exceptions · " + exceptionCount + " active"}><Bell size={18} />{exceptionCount > 0 && <span className="exception-badge">{exceptionCount > 99 ? "99+" : exceptionCount}</span>}</button>
          <div className="avatar">{role === "owner" ? "MR" : "SR"}</div>
          <div className="profile"><b>{role === "owner" ? "Maya Rahman" : "Sam Rahman"}</b><span>{role === "owner" ? "Owner" : "Property Manager"}</span></div>
          <ChevronDown size={16} />
        </div>
      </header>

      <div className="content">
        {active === "overview" && <Overview {...pageProps} />}
        {active === "frontdesk" && <FrontDesk {...pageProps} />}
        {active === "newreservation" && <NewReservation {...pageProps} />}
        {active === "reservations" && <Reservations {...pageProps} />}
        {active === "exceptions" && <ExceptionCenter {...pageProps} />}
        {active === "inbox" && <GuestInbox {...pageProps} />}
        {active === "rooms" && <Rooms {...pageProps} />}
        {active === "inventory" && <Inventory {...pageProps} />}
        {active === "approvals" && <ApprovalCenter {...pageProps} />}
        {active === "expenses" && role === "owner" && <Expenses {...pageProps} />}
        {active === "channels" && role === "owner" && <Channels {...pageProps} />}
        {active === "marketing" && role === "owner" && <Marketing {...pageProps} />}
        {active === "operations" && <Operations {...pageProps} />}
        {active === "instructions" && <Instructions {...pageProps} />}
        {active === "booking" && role === "owner" && <BookingEngine {...pageProps} />}
        {active === "automations" && <AutomationCenter {...pageProps} />}
        {active === "audit" && <AuditLog {...pageProps} />}
        {active === "permissions" && role === "owner" && <RolePolicy {...pageProps} />}
        {active === "assistant" && <Assistant {...pageProps} />}
        {active === "connections" && role === "owner" && <Connections {...pageProps} />}
        {active === "setup" && role === "owner" && <PropertySetup {...pageProps} />}
      </div>
    </main>

    {commandOpen && <div className="command-backdrop" onMouseDown={() => setCommandOpen(false)}>
      <div className="command-palette" onMouseDown={e => e.stopPropagation()}>
        <div className="command-search"><Search size={18} /><input autoFocus value={commandQuery} onChange={e => setCommandQuery(e.target.value)} placeholder="Search workspaces..." /><kbd>ESC</kbd></div>
        <div className="command-label">Workspaces</div>
        <div className="command-grid">
          {nav.filter(([, label]) => label.toLowerCase().includes(commandQuery.toLowerCase())).map(([id, label, Icon]) => <button key={id} onClick={() => { setActive(id); setCommandOpen(false); setCommandQuery(""); }}>
            <span><Icon size={17} /></span><div><b>{label}</b><small>{id === "assistant" ? "Operate hotel actions with natural language" : id === "booking" ? "Create a stateful demo reservation" : "Open " + label.toLowerCase()}</small></div><ArrowUpRight size={14} />
          </button>)}
        </div>
        <div className="command-tip"><Sparkles size={14} /> Use the role switch to preview owner-level business controls or manager-level property operations.</div>
      </div>
    </div>}
    {notice && <div className="toast"><CheckCircle2 size={18} />{notice}<button onClick={() => setNotice("")}><X size={14} /></button></div>}
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
  </div>;
}

function Overview({ stats, activities, setActive, role, rooms, approvals, stock, automationRules, automationLogs }) {
  const owner = role === "owner";
  const attentionRooms = rooms.filter(r => r.housekeeping !== "Clean" || r.maintenance !== "Clear");
  const readyRooms = rooms.filter(roomSellable).length;
  const currentStock = stock || seedStock;
  const currentExpenses = load("sp-expenses", seedExpenses);
  const currentInstructions = load("sp-instructions", seedInstructions);
  const todayExpenses = currentExpenses.filter(e => e.date === "Sep 23");
  const expensesToday = todayExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const mtdExpenses = currentExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const expenseBudget = 26000;
  const stockValue = currentStock.reduce((a, i) => a + Number(i.stock || 0) * Number(i.cost || 0), 0);
  const currentCampaigns = load("sp-campaigns", seedCampaigns);
  const campaignSpend = currentCampaigns.reduce((a, c) => a + Number(c.spend || 0), 0);
  const campaignRevenue = currentCampaigns.reduce((a, c) => a + Number(c.revenue || 0), 0);
  const paidRoas = campaignSpend ? campaignRevenue / campaignSpend : 0;
  const pendingApprovals = approvals.filter(a => a.status === "Pending").length;
  const lowStock = currentStock.filter(i => i.stock < i.par).length;
  const roleRules = (automationRules || []).filter(r => owner || r.scope === "Operations");
  const automationRuns = roleRules.reduce((n,r) => n + Number(r.runs || 0), 0);
  const automationMinutes = roleRules.reduce((n,r) => n + Number(r.minutesSaved || 0), 0);
  const automationFailures = roleRules.reduce((n,r) => n + Number(r.failures || 0), 0);
  const openSystemExceptions = load("sp-exceptions", seedSystemExceptions).filter(x => x.status === "Open" && (owner || x.type !== "Distribution")).length;
  const humanAttention = attentionRooms.length + pendingApprovals + openSystemExceptions;

  const ownerKpis = [
    ["Occupancy", stats.occupancy + "%", "+6.8%", TrendingUp, "vs. last week"],
    ["Gross revenue", fmt(stats.revenue), "+12.4%", DollarSign, "today"],
    ["Operating expenses", fmt(mtdExpenses), Math.round(mtdExpenses / expenseBudget * 100) + "% budget", ReceiptText, "month to date"],
    ["Pending approvals", String(pendingApprovals), pendingApprovals ? "Review" : "Clear", ShieldCheck, "owner decision queue"]
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
      title={owner ? "Property command center" : "Your shift"}
      text={owner ? "Routine hotel work runs automatically. Start with the exceptions, approvals and outcomes that need an Owner decision." : "Work the exceptions StayPilot could not safely resolve on its own, then handle today’s arrivals and room readiness."}
      action={<div className="page-actions">
        {!owner && <button className="ghost-btn" onClick={() => setActive("instructions")}><ClipboardList size={16} /> Instructions</button>}
        <button className="primary-btn" onClick={() => setActive("newreservation")}><Plus size={16} /> New reservation</button>
      </div>}
    />

    <section className="automation-summary owner-command-summary">
      <div><span>Needs human attention</span><b>{humanAttention}</b><small>rooms, approvals & exceptions</small></div>
      <div><span>Automation handled</span><b>{automationRuns}</b><small>recorded workflow executions</small></div>
      <div><span>Estimated time saved</span><b>{(automationMinutes / 60).toFixed(1)}h</b><small>{automationMinutes} staff minutes</small></div>
      <div><span>Automation failures</span><b>{automationFailures}</b><small>{automationFailures ? "visible for review" : "all clear"}</small></div>
    </section>

    <section className="ops-pulse">
      <div className="ops-pulse-label"><span className="live-dot" /><div><b>{owner ? "Business pulse" : "Shift pulse"}</b><small>Live operational signals</small></div></div>
      <button onClick={() => setActive("reservations")}><span>Next arrival</span><b>14:30 · Olivia Martin</b><ArrowUpRight size={14} /></button>
      <button onClick={() => setActive("rooms")}><span>Room attention</span><b>{attentionRooms.length} active issues</b><ArrowUpRight size={14} /></button>
      <button onClick={() => setActive("inventory")}><span>Inventory</span><b>{lowStock} below par</b><ArrowUpRight size={14} /></button>
      <button className="pulse-ai" onClick={() => setActive("assistant")}><Bot size={15} /><span><b>Operations assistant</b><small>Run approved actions</small></span></button>
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
        <button className="panel owner-field" onClick={() => setActive("automations")}><span className="field-icon"><Zap size={19} /></span><div><span>Automation engine</span><b>{automationRuns} actions</b><small>{(automationMinutes / 60).toFixed(1)}h estimated saved</small></div><ArrowUpRight size={15} /></button>
        <button className="panel owner-field" onClick={() => setActive("exceptions")}><span className="field-icon"><Bell size={19} /></span><div><span>Exceptions</span><b>{openSystemExceptions} open</b><small>automation could not safely resolve</small></div><ArrowUpRight size={15} /></button>
        <button className="panel owner-field" onClick={() => setActive("approvals")}><span className="field-icon"><ShieldCheck size={19} /></span><div><span>Decision queue</span><b>{pendingApprovals} pending</b><small>rate, spend & refund approvals</small></div><ArrowUpRight size={15} /></button>
        <button className="panel owner-field" onClick={() => setActive("inventory")}><span className="field-icon"><Boxes size={19} /></span><div><span>Supply inventory value</span><b>{fmt(Math.round(stockValue))}</b><small>{lowStock} items need reorder</small></div><ArrowUpRight size={15} /></button>
        <button className="panel owner-field" onClick={() => setActive("channels")}><span className="field-icon"><RefreshCw size={19} /></span><div><span>OTA exposure</span><b>62%</b><small>38% direct share</small></div><ArrowUpRight size={15} /></button>
        <button className="panel owner-field" onClick={() => setActive("marketing")}><span className="field-icon"><Megaphone size={19} /></span><div><span>Paid acquisition</span><b>{paidRoas.toFixed(2)}x</b><small>blended ROAS</small></div><ArrowUpRight size={15} /></button>
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-head"><div><span className="panel-kicker">Performance</span><h3>Revenue & booking pace</h3></div><span className="period-label">Last 7 days</span></div>
          <div className="chart-stat"><b>$58,950</b><span><TrendingUp size={13} /> 14.2% vs previous period</span></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14543f" stopOpacity={0.22} /><stop offset="100%" stopColor="#14543f" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#e8edf5" vertical={false} /><XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fill: "#78859a", fontSize: 12 }} /><YAxis hide />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4eaf2", boxShadow: "0 10px 30px rgba(20,35,60,.12)" }} formatter={v => [fmt(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#14543f" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <ActivityPanel activities={activities} setActive={setActive} />
      </section>

      <section className="bottom-grid">
        <article className="panel channel-panel">
          <div className="panel-head"><div><span className="panel-kicker">Distribution</span><h3>Booking channel mix</h3></div><span className="period-label">Current mix</span></div>
          <div className="bar-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={channelData} barSize={24}><CartesianGrid stroke="#edf1f7" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#78859a", fontSize: 11 }} /><YAxis hide /><Tooltip cursor={{ fill: "#f5f7fb" }} contentStyle={{ borderRadius: 12, border: "1px solid #e4eaf2" }} formatter={v => [v + "%", "Share"]} /><Bar dataKey="value" fill="#1b624b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
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
            {rooms.filter(r => r.housekeeping !== "Clean" || r.maintenance !== "Clear" || r.occupancy === "Reserved").slice(0, 6).map(r => { const status = roomPrimaryStatus(r); return <div key={r.number}><span className={"room-dot " + status.toLowerCase().replaceAll(" ","-")} /><div><b>Room {r.number}</b><small>{r.type} · {r.housekeeping}</small></div><StatusDot status={status} /></div>; })}
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

function FrontDesk({ bookings, setBookings, rooms, setRooms, role, approvals, setApprovals, policy, pushActivity, flash, setActive, emitHotelEvent }) {
  const [selected, setSelected] = useState(null);
  const activeBookings = bookings.filter(b => !["Cancelled", "Checked out"].includes(b.status));
  const unassigned = activeBookings.filter(b => !b.room || b.room === "Unassigned");
  const arrivals = activeBookings.filter(b => b.checkIn === "Today").length;
  const departures = activeBookings.filter(b => b.checkOut === "Sep 23").length;
  const prep = rooms.filter(r => r.housekeeping !== "Clean" || r.maintenance !== "Clear").length;

  const bookingsForRoom = roomNumber => activeBookings.filter(b => b.room === roomNumber);

  return <>
    <PageHeader
      eyebrow="Front desk"
      title="Reservation calendar"
      text="See room assignments, arrivals, departures, readiness and stay conflicts across the same operational inventory."
      action={<div className="page-actions"><button className="ghost-btn" onClick={() => setActive("reservations")}><ClipboardCheck size={16} /> Reservation list</button><button className="primary-btn" onClick={() => setActive("newreservation")}><Plus size={16} /> New reservation</button></div>}
    />

    <section className="frontdesk-summary">
      <div><span>Arrivals today</span><b>{arrivals}</b><small>front desk queue</small></div>
      <div><span>Departures today</span><b>{departures}</b><small>checkout workload</small></div>
      <div><span>Unassigned</span><b>{unassigned.length}</b><small>room assignment needed</small></div>
      <div><span>Room blockers</span><b>{prep}</b><small>cleaning + maintenance</small></div>
    </section>

    {unassigned.length > 0 && <section className="panel unassigned-queue">
      <div className="panel-head"><div><span className="panel-kicker">Assignment queue</span><h3>Reservations waiting for a room</h3></div><span className="instruction-count">{unassigned.length} open</span></div>
      <div className="unassigned-list">{unassigned.map(b => <button key={b.id} onClick={() => setSelected(b)}><span className="guest-mini">{b.guest.split(" ").map(x => x[0]).slice(0,2).join("")}</span><div><b>{b.guest}</b><small>{b.id} · {b.type} · {b.checkIn}</small></div><span>Assign room</span><ArrowUpRight size={15} /></button>)}</div>
    </section>}

    <article className="panel tape-panel">
      <div className="panel-head"><div><span className="panel-kicker">7-day tape chart</span><h3>Rooms & stays</h3></div><div className="tape-legend"><span><i className="legend-confirmed" /> Confirmed</span><span><i className="legend-inhouse" /> In house</span></div></div>
      <div className="tape-scroll">
        <div className="tape-grid tape-header">
          <div className="tape-room-head">Room</div>
          {frontDeskDays.map((d, i) => <div className={i === 0 ? "today" : ""} key={d}><b>{d.replace("Sep ","")}</b><small>{["Wed","Thu","Fri","Sat","Sun","Mon","Tue"][i]}</small></div>)}
        </div>
        {rooms.map(room => <div className="tape-grid tape-row" key={room.number}>
          <div className="tape-room">
            <div><b>{room.number}</b><small>{room.type}</small></div>
            <span className={"room-dot " + roomPrimaryStatus(room).toLowerCase().replaceAll(" ","-")} />
          </div>
          {frontDeskDays.map((d, i) => <div className={"tape-day-cell " + (i === 0 ? "today" : "")} style={{ gridColumn: i + 2 }} key={d} />)}
          {bookingsForRoom(room.number).map(b => {
            const start = Math.max(0, dateIndex(b.checkIn));
            const rawEnd = dateIndex(b.checkOut);
            const end = rawEnd < 0 ? frontDeskDays.length : rawEnd;
            const span = Math.max(1, Math.min(frontDeskDays.length - start, end - start));
            return <button
              className={"stay-block " + (b.status === "Checked in" ? "inhouse" : "confirmed")}
              style={{ gridColumn: (start + 2) + " / span " + span }}
              key={b.id}
              onClick={() => setSelected(b)}
              title={b.guest + " · " + b.id}
            ><b>{b.guest}</b><small>{b.id}</small></button>;
          })}
        </div>)}
      </div>
    </article>

    {selected && <ReservationDrawer booking={bookings.find(b => b.id === selected.id) || selected} bookings={bookings} setBookings={setBookings} rooms={rooms} setRooms={setRooms} role={role} approvals={approvals} setApprovals={setApprovals} policy={policy} pushActivity={pushActivity} flash={flash} emitHotelEvent={emitHotelEvent} onClose={() => setSelected(null)} />}
  </>;
}

function ReservationDrawer({ booking, setBookings, rooms, setRooms, role, approvals, setApprovals, policy, pushActivity, flash, emitHotelEvent, onClose }) {
  const [roomNumber, setRoomNumber] = useState(booking.room && booking.room !== "Unassigned" ? booking.room : "");
  const candidateRooms = rooms.filter(r => r.type === booking.type && r.maintenance === "Clear" && (r.occupancy === "Vacant" || r.number === booking.room));
  const currentRoom = rooms.find(r => r.number === booking.room);
  const paid = Number(booking.paid ?? (booking.status === "Checked in" ? booking.total : Math.round(booking.total * 0.2)));
  const taxAndFees = Math.round(Number(booking.total) * 0.12);
  const roomCharges = Math.max(0, Number(booking.total) - taxAndFees);
  const balance = Math.max(0, Number(booking.total) - paid);
  const refundAmount = Math.min(85, paid);

  const updateBooking = patch => setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, ...patch } : b));

  const assignRoom = () => {
    if (!roomNumber) return flash("Choose a room first");
    const target = rooms.find(r => r.number === roomNumber);
    if (!target) return flash("Room not found");
    if (target.maintenance !== "Clear") return flash("That room is blocked by maintenance");
    if (booking.room && booking.room !== "Unassigned" && booking.room !== roomNumber) {
      setRooms(prev => prev.map(r => r.number === booking.room ? { ...r, occupancy: "Vacant" } : r));
    }
    setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, occupancy: booking.status === "Checked in" ? "Occupied" : "Reserved" } : r));
    updateBooking({ room: roomNumber });
    pushActivity("green", "Room assigned to " + booking.guest, booking.id + " · Room " + roomNumber);
    flash("Room " + roomNumber + " assigned");
  };

  const checkIn = () => {
    const target = rooms.find(r => r.number === (roomNumber || booking.room));
    if (!target || !target.number || target.number === "Unassigned") return flash("Assign a room before check-in");
    if (target.housekeeping !== "Clean") return flash("Room " + target.number + " is not ready for check-in");
    if (target.maintenance !== "Clear") return flash("Room " + target.number + " has an active maintenance block");
    updateBooking({ status: "Checked in", room: target.number });
    setRooms(prev => prev.map(r => r.number === target.number ? { ...r, occupancy: "Occupied" } : r));
    pushActivity("green", booking.guest + " checked in", booking.id + " · Room " + target.number);
    flash("Guest checked in");
  };

  const checkOut = () => {
    if (balance > 0) return flash("Collect the remaining balance before checkout");
    updateBooking({ status: "Checked out" });
    const result = emitHotelEvent("guest.checked_out", { booking: { ...booking, status: "Checked out" }, roomNumber: booking.room });
    if (!result?.ok && !result?.queued) {
      if (booking.room && booking.room !== "Unassigned") setRooms(prev => prev.map(r => r.number === booking.room ? { ...r, occupancy: "Vacant", housekeeping: "Dirty" } : r));
      pushActivity("blue", booking.guest + " checked out", booking.id + " · room marked dirty; automation unavailable");
    }
    flash(result?.ok ? "Checkout complete · turnover automation executed" : result?.queued ? "Checkout recorded · turnover automation queued" : "Checkout complete · room marked dirty");
  };

  const captureBalance = () => {
    if (balance <= 0) return flash("Folio is already paid");
    updateBooking({ paid: Number(booking.total) });
    pushActivity("green", "Reservation balance captured", booking.id + " · " + fmt(balance), "Operations");
    flash("Balance captured");
  };

  const refund = () => {
    if (refundAmount <= 0) return flash("No captured payment available to refund");
    if (role === "manager" && refundAmount > Number(policy.managerRefundLimit || 0)) {
      const existing = approvals.find(a => a.status === "Pending" && a.type === "Refund" && a.reservationRef === booking.id);
      if (existing) return flash(existing.id + " is already awaiting Owner approval");
      const item = { id: "APR-" + (105 + approvals.length), type: "Refund", title: booking.id + " refund", detail: booking.guest + " · service recovery", amount: refundAmount, reservationRef: booking.id, requestedBy: "Sam Rahman", status: "Pending", time: "just now" };
      setApprovals(prev => [item, ...prev]);
      pushActivity("blue", "Refund approval requested", item.id + " · " + booking.id + " · " + fmt(refundAmount), "Governance");
      return flash("Refund sent to Owner approval");
    }
    updateBooking({ paid: Math.max(0, paid - refundAmount) });
    pushActivity("amber", "Reservation refund issued", booking.id + " · " + fmt(refundAmount), "Operations");
    flash(fmt(refundAmount) + " refunded");
  };

  const cancel = () => {
    updateBooking({ status: "Cancelled" });
    const result = emitHotelEvent("reservation.cancelled", { booking: { ...booking, status: "Cancelled" } });
    if (!result?.ok && !result?.queued && booking.room && booking.room !== "Unassigned") {
      setRooms(prev => prev.map(r => r.number === booking.room ? { ...r, occupancy: "Vacant" } : r));
      pushActivity("amber", "Reservation cancelled", booking.id + " · inventory released without automation");
    }
    flash(result?.ok ? "Reservation cancelled · recovery automation executed" : result?.queued ? "Reservation cancelled · recovery automation queued" : "Reservation cancelled");
    onClose();
  };

  return <div className="drawer-backdrop" onMouseDown={onClose}>
    <aside className="reservation-drawer" onMouseDown={e => e.stopPropagation()}>
      <div className="drawer-head"><div><span className="panel-kicker">Reservation {booking.id}</span><h2>{booking.guest}</h2><p>{booking.source} · {booking.guests} guest{booking.guests > 1 ? "s" : ""}</p></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
      <div className="drawer-status"><StatusDot status={booking.status} /><span>{booking.checkIn} → {booking.checkOut}</span></div>

      <section className="drawer-section"><span className="drawer-label">Stay</span><div className="drawer-facts"><div><span>Room type</span><b>{booking.type}</b></div><div><span>Assigned room</span><b>{booking.room || "Unassigned"}</b></div><div><span>Total</span><b>{fmt(booking.total)}</b></div><div><span>Payment</span><b>{balance > 0 ? "Balance due" : "Paid"}</b></div></div></section>

      <section className="drawer-section"><span className="drawer-label">Folio & payment</span>
        <div className="folio-lines">
          <div><span>Room charges</span><b>{fmt(roomCharges)}</b></div>
          <div><span>Taxes & fees</span><b>{fmt(taxAndFees)}</b></div>
          <div><span>Captured / deposit</span><b>{fmt(paid)}</b></div>
          <div className="folio-total"><span>Balance due</span><b>{fmt(balance)}</b></div>
        </div>
        <div className="folio-actions">{balance > 0 && <button className="secondary-btn" onClick={captureBalance}><CreditCard size={15} /> Capture {fmt(balance)}</button>}{paid > 0 && <button className="ghost-btn" onClick={refund}>Refund {fmt(refundAmount)}</button>}</div>
      </section>

      <section className="drawer-section"><span className="drawer-label">Room assignment</span><div className="drawer-assign"><select value={roomNumber} onChange={e => setRoomNumber(e.target.value)}><option value="">Choose {booking.type}</option>{candidateRooms.map(r => <option value={r.number} key={r.number}>Room {r.number} · {r.housekeeping}{r.occupancy !== "Vacant" ? " · " + r.occupancy : ""}</option>)}</select><button className="secondary-btn" onClick={assignRoom}>Assign room</button></div>{currentRoom && <div className="room-readiness-line"><span>Housekeeping <b>{currentRoom.housekeeping}</b></span><span>Maintenance <b>{currentRoom.maintenance}</b></span></div>}</section>

      <section className="drawer-section"><span className="drawer-label">Guest notes</span><div className="guest-note">Late arrival expected. Front desk should verify arrival time and welcome preference before check-in.</div></section>

      <div className="drawer-actions">
        {booking.status === "Confirmed" && <button className="primary-btn" onClick={checkIn}><CheckCircle2 size={16} /> Check in</button>}
        {booking.status === "Checked in" && <button className="primary-btn" onClick={checkOut}><CheckCircle2 size={16} /> Check out</button>}
        {!["Cancelled","Checked out"].includes(booking.status) && <button className="danger-btn" onClick={cancel}>Cancel reservation</button>}
      </div>
      <div className="drawer-audit"><ShieldCheck size={14} /> Changes are attributed to {role === "owner" ? "Maya Rahman · Owner" : "Sam Rahman · Property Manager"}.</div>
    </aside>
  </div>;
}

function NewReservation({ rooms, setRooms, bookings, setBookings, rateMultiplier, pushActivity, flash, setActive, emitHotelEvent }) {
  const [form, setForm] = useState({ guest: "", type: "Deluxe King", source: "Walk-in", checkIn: "Sep 23", checkOut: "Sep 25", guests: 2, room: "" });
  const rates = { "City Queen": 149, "Deluxe King": 189, "Sky Suite": 279 };
  const start = Math.max(0, dateIndex(form.checkIn));
  const end = Math.max(start + 1, dateIndex(form.checkOut));
  const nights = Math.max(1, end - start);
  const rate = Math.round(rates[form.type] * rateMultiplier);
  const total = rate * nights;
  const candidates = rooms.filter(r => r.type === form.type && roomSellable(r));

  useEffect(() => {
    if (form.room && !candidates.some(r => r.number === form.room)) setForm(f => ({ ...f, room: "" }));
  }, [form.type]);

  const submit = e => {
    e.preventDefault();
    if (!form.guest.trim()) return flash("Add a guest name");
    if (dateIndex(form.checkOut) <= dateIndex(form.checkIn)) return flash("Checkout must be after check-in");
    const id = "SP-" + (1050 + bookings.length);
    const booking = {
      id,
      guest: form.guest.trim(),
      paid: 0,
      room: form.room || "Unassigned",
      type: form.type,
      source: form.source,
      checkIn: form.checkIn === "Sep 23" ? "Today" : form.checkIn,
      checkOut: form.checkOut,
      guests: Number(form.guests),
      total,
      status: "Confirmed"
    };
    setBookings(prev => [booking, ...prev]);
    emitHotelEvent("reservation.created", { booking });
    if (form.room) setRooms(prev => prev.map(r => r.number === form.room ? { ...r, occupancy: "Reserved" } : r));
    pushActivity("green", "Front desk reservation created", id + " · " + form.guest.trim() + " · " + (form.room ? "Room " + form.room : "room unassigned"));
    flash("Reservation " + id + " created");
    setActive("frontdesk");
  };

  return <>
    <PageHeader eyebrow="Front desk" title="New reservation" text="Create walk-in, phone or manually entered stays without using the guest-facing booking engine." action={<button className="ghost-btn" onClick={() => setActive("frontdesk")}><CalendarDays size={16} /> Back to calendar</button>} />
    <section className="internal-reservation-layout">
      <form className="panel internal-reservation-form" onSubmit={submit}>
        <div className="panel-head"><div><span className="panel-kicker">Stay details</span><h3>Create reservation</h3></div></div>
        <div className="internal-form-grid">
          <label>Guest name<input value={form.guest} onChange={e => setForm({...form,guest:e.target.value})} placeholder="Guest full name" /></label>
          <label>Source<select value={form.source} onChange={e => setForm({...form,source:e.target.value})}><option>Walk-in</option><option>Phone</option><option>Email</option><option>Direct</option></select></label>
          <label>Room type<select value={form.type} onChange={e => setForm({...form,type:e.target.value,room:""})}><option>City Queen</option><option>Deluxe King</option><option>Sky Suite</option></select></label>
          <label>Guests<select value={form.guests} onChange={e => setForm({...form,guests:e.target.value})}><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
          <label>Check in<select value={form.checkIn} onChange={e => setForm({...form,checkIn:e.target.value})}>{frontDeskDays.slice(0,-1).map(d => <option key={d}>{d}</option>)}</select></label>
          <label>Check out<select value={form.checkOut} onChange={e => setForm({...form,checkOut:e.target.value})}>{frontDeskDays.slice(1).map(d => <option key={d}>{d}</option>)}</select></label>
          <label className="span-two">Room assignment <span className="field-hint">optional</span><select value={form.room} onChange={e => setForm({...form,room:e.target.value})}><option value="">Assign later</option>{candidates.map(r => <option key={r.number} value={r.number}>Room {r.number} · {r.type}</option>)}</select></label>
        </div>
        <div className="internal-form-actions"><button type="button" className="ghost-btn" onClick={() => setActive("frontdesk")}>Cancel</button><button className="primary-btn" type="submit"><Plus size={16} /> Create reservation</button></div>
      </form>
      <aside className="panel reservation-quote">
        <span className="panel-kicker">Reservation summary</span><h3>{form.type}</h3>
        <div><span>Dates</span><b>{form.checkIn} → {form.checkOut}</b></div>
        <div><span>Stay</span><b>{nights} night{nights > 1 ? "s" : ""}</b></div>
        <div><span>Rate</span><b>{fmt(rate)} / night</b></div>
        <div><span>Room</span><b>{form.room ? "Room " + form.room : "Assign later"}</b></div>
        <div className="quote-total"><span>Estimated total</span><b>{fmt(total)}</b></div>
        <p>{candidates.length} clean, unblocked {form.type} rooms are currently available for assignment.</p>
      </aside>
    </section>
  </>;
}

function Reservations({ bookings, setBookings, rooms, setRooms, role, approvals, setApprovals, policy, pushActivity, flash, setActive, emitHotelEvent }) {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const list = filter === "All" ? bookings : bookings.filter(b => b.status === filter);
  return <>
    <PageHeader eyebrow="Reservations" title="Reservation operations" text="Review guest stays, room assignment, payment state and front-desk actions from one operational list." action={<div className="page-actions"><button className="ghost-btn" onClick={() => setActive("frontdesk")}><CalendarDays size={16} /> Calendar</button><button className="primary-btn" onClick={() => setActive("newreservation")}><Plus size={16} /> New reservation</button></div>} />
    <div className="toolbar">
      <div className="segmented">{["All", "Confirmed", "Checked in", "Checked out"].map(x => <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x}</button>)}</div>
      <button className="ghost-btn"><CalendarDays size={15} /> Sep 23 — Sep 30</button>
    </div>
    <article className="panel table-panel">
      <div className="table-scroll">
        <table>
          <thead><tr><th>Reservation</th><th>Guest</th><th>Stay</th><th>Room</th><th>Source</th><th>Value</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map(b => <tr key={b.id} className="clickable-row" onClick={() => setSelected(b)}>
            <td><b>{b.id}</b></td>
            <td><div className="guest-cell"><span>{b.guest.split(" ").map(x => x[0]).slice(0,2).join("")}</span><div><b>{b.guest}</b><small>{b.guests} guest{b.guests > 1 ? "s" : ""}</small></div></div></td>
            <td><b>{b.checkIn}</b><small>{b.checkOut}</small></td>
            <td><b>{b.room || "Unassigned"}</b><small>{b.type}</small></td>
            <td><span className={"source source-" + b.source.toLowerCase().replaceAll(" ","-").replace(".","")}>{b.source}</span></td>
            <td><b>{fmt(b.total)}</b><small>{Number(b.paid ?? (b.status === "Checked in" ? b.total : Math.round(b.total * 0.2))) >= Number(b.total) ? "Paid" : "Deposit / secured"}</small></td>
            <td><StatusDot status={b.status} /></td>
            <td><button className="icon-btn flat" onClick={e => { e.stopPropagation(); setSelected(b); }}><MoreHorizontal size={17} /></button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </article>
    <div className="mini-note"><CalendarDays size={15} /> Select a reservation to assign rooms, check guests in or out, or cancel the stay.</div>
    {selected && <ReservationDrawer booking={bookings.find(b => b.id === selected.id) || selected} bookings={bookings} setBookings={setBookings} rooms={rooms} setRooms={setRooms} role={role} approvals={approvals} setApprovals={setApprovals} policy={policy} pushActivity={pushActivity} flash={flash} emitHotelEvent={emitHotelEvent} onClose={() => setSelected(null)} />}
  </>;
}

function Rooms({ rooms, setRooms, pushActivity, flash, role, policy, emitHotelEvent }) {
  const grouped = ["Available", "Occupied", "Reserved", "Cleaning", "Maintenance"];
  const canManage = role === "owner" || policy.managerCanManageRooms;
  const counts = Object.fromEntries(grouped.map(s => [s, rooms.filter(r => roomPrimaryStatus(r) === s).length]));

  const setHousekeeping = (number, housekeeping) => {
    if (!canManage) return flash("Manager room controls are restricted by Owner policy");
    setRooms(prev => prev.map(r => r.number === number ? { ...r, housekeeping } : r));
    if (housekeeping === "Clean") emitHotelEvent("housekeeping.completed", { roomNumber: number });
    else pushActivity("amber", "Room " + number + " housekeeping updated", housekeeping);
    flash("Room " + number + " housekeeping: " + housekeeping);
  };
  const toggleMaintenance = room => {
    if (!canManage) return flash("Manager room controls are restricted by Owner policy");
    const maintenance = room.maintenance === "Clear" ? "Out of order" : "Clear";
    setRooms(prev => prev.map(r => r.number === room.number ? { ...r, maintenance } : r));
    if (maintenance === "Out of order") emitHotelEvent("room.maintenance_blocked", { roomNumber: room.number });
    else pushActivity("green", "Room " + room.number + " maintenance cleared", "Returned to operational pool");
    flash("Room " + room.number + ": " + maintenance);
  };
  const syncInventory = () => {
    if (role === "manager" && !policy.managerCanSyncChannels) return flash("Channel reconciliation is restricted by Owner policy");
    const sellable = rooms.filter(roomSellable).length;
    pushActivity("green", "Room inventory synchronized", sellable + " sellable rooms · 5 channels");
    flash("Inventory synced across connected channels");
  };

  return <>
    <PageHeader eyebrow="Rooms" title="Room readiness & availability" text="Occupancy, housekeeping and maintenance are tracked independently so operational changes never overwrite reservation state." action={<button className="ghost-btn" onClick={syncInventory}><RefreshCw size={15} /> Sync inventory</button>} />
    <section className="status-summary">{grouped.map(s => <div key={s}><span className={"room-dot " + s.toLowerCase()} /><div><b>{counts[s]}</b><span>{s}</span></div></div>)}</section>
    <article className="panel room-board">
      <div className="panel-head"><div><span className="panel-kicker">Operational room board</span><h3>Occupancy + housekeeping + maintenance</h3></div><div className="live-label"><i /> shared room state</div></div>
      <div className="room-grid">{rooms.map(r => {
        const primary = roomPrimaryStatus(r);
        return <div className={"room-card " + primary.toLowerCase().replaceAll(" ","-")} key={r.number}>
          <div className="room-card-top"><b>{r.number}</b><span>{r.type}</span></div>
          <div className="room-state-stack"><span><small>Occupancy</small><b>{r.occupancy}</b></span><span><small>Housekeeping</small><b>{r.housekeeping}</b></span><span><small>Maintenance</small><b>{r.maintenance}</b></span></div>
          <div className="sellable-line"><span className={"room-dot " + primary.toLowerCase().replaceAll(" ","-")} /><b>{roomSellable(r) ? "Sellable" : primary}</b></div>
          <div className="room-actions">
            {r.housekeeping !== "Clean" && <button onClick={() => setHousekeeping(r.number, "Clean")}><CheckCircle2 size={13} /> Ready</button>}
            {r.housekeeping !== "Cleaning" && <button onClick={() => setHousekeeping(r.number, "Cleaning")}><Clock3 size={13} /> Clean</button>}
            <button onClick={() => toggleMaintenance(r)}><Wrench size={13} />{r.maintenance === "Clear" ? " Block" : " Clear"}</button>
          </div>
        </div>;
      })}</div>
    </article>
  </>;
}

function Inventory({ role, approvals, setApprovals, pushActivity, flash, setActive, policy, stock, setStock, emitHotelEvent }) {
  const low = stock.filter(i => i.stock < i.par);
  const value = stock.reduce((a, i) => a + i.stock * i.cost, 0);
  const canManage = role === "owner" || policy.managerCanManageInventory;
  const adjust = (id, delta) => {
    if (!canManage) return flash("Manager inventory controls are restricted by Owner policy");
    const item = stock.find(i => i.id === id);
    if (!item) return;
    const nextStock = Math.max(0, item.stock + delta);
    setStock(prev => prev.map(i => i.id === id ? { ...i, stock: nextStock } : i));
    if (item.stock >= item.par && nextStock < item.par) emitHotelEvent("inventory.low_stock", { item: { ...item, stock: nextStock } });
  };
  const requestOrder = item => {
    const existing = approvals.find(a => a.type === "Purchase order" && a.itemRef === item.id && ["Pending", "Approved"].includes(a.status));
    if (existing) return flash(existing.status === "Approved" ? "Order approved · receive it when delivered" : "Purchase request is already awaiting approval");
    const qty = Math.max(item.par - item.stock, Math.ceil(item.par * .35));
    if (!canManage) return flash("Manager inventory controls are restricted by Owner policy");
    const amount = Number((qty * item.cost).toFixed(2));
    const status = role === "owner" || amount <= Number(policy.managerPurchaseLimit || 0) ? "Approved" : "Pending";
    const order = {
      id: "APR-" + (105 + approvals.length),
      type: "Purchase order",
      title: item.item + " restock",
      detail: qty + " " + item.unit + " · " + item.supplier,
      amount,
      itemRef: item.id,
      qty,
      requestedBy: role === "owner" ? "Maya Rahman" : "Sam Rahman",
      status,
      time: "just now"
    };
    setApprovals(prev => [order, ...prev]);
    pushActivity(status === "Approved" ? "green" : "blue", "Purchase order " + status.toLowerCase(), order.id + " · " + item.item);
    flash(status === "Approved" ? "Purchase order approved · awaiting delivery" : "Purchase request sent to Owner");
  };
  const receiveOrder = (item, order) => {
    if (!canManage) return flash("Manager inventory controls are restricted by Owner policy");
    setStock(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock + Number(order.qty || 0) } : i));
    setApprovals(prev => prev.map(a => a.id === order.id ? { ...a, status: "Received" } : a));
    pushActivity("green", "Inventory delivery received", item.item + " · +" + order.qty + " " + item.unit);
    flash(item.item + " received into stock");
  };

  return <>
    <PageHeader
      eyebrow="Property supplies"
      title="Supplies & inventory"
      text={role === "owner" ? "Track stock value, par levels, suppliers and operating inventory across the property." : "Keep housekeeping, amenities and guest supplies above operational par levels."}
      action={<button className="ghost-btn" onClick={() => setActive("approvals")}><ShieldCheck size={16} /> Purchase requests</button>}
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
          const order = approvals.find(a => a.type === "Purchase order" && a.itemRef === item.id && ["Pending", "Approved"].includes(a.status));
          return <tr key={item.id}>
            <td><b>{item.item}</b><small>{item.unit}</small></td>
            <td>{item.category}</td>
            <td><div className="stock-stepper"><button onClick={() => adjust(item.id, -1)}>−</button><b>{item.stock}</b><button onClick={() => adjust(item.id, 1)}>+</button></div></td>
            <td>{item.par}</td>
            <td><span className={"stock-health " + (lowItem ? "low" : "good")}><i />{lowItem ? "Below par" : "Healthy"}</span></td>
            {role === "owner" && <><td>{fmt(item.cost)}</td><td><b>{fmt(Math.round(item.stock * item.cost))}</b></td></>}
            <td>{item.supplier}</td>
            <td>{order?.status === "Approved" ? <button className="row-action receive-action" onClick={() => receiveOrder(item, order)}>Receive stock</button> : order?.status === "Pending" ? <span className="order-waiting">Awaiting approval</span> : lowItem ? <button className="row-action" onClick={() => requestOrder(item)}>{role === "owner" ? "Create PO" : "Request order"}</button> : <span className="stock-no-action">No action</span>}</td>
          </tr>;
        })}
      </tbody></table></div>
    </article>
  </>;
}

function ApprovalCenter({ role, approvals, setApprovals, rateMultiplier, setRateMultiplier, metaPaused, setMetaPaused, pushActivity, flash, bookings, setBookings, emitHotelEvent }) {
  const [draft, setDraft] = useState({ type: "Purchase order", title: "", detail: "", amount: "" });
  const pending = approvals.filter(a => a.status === "Pending");
  const myRequests = approvals.filter(a => a.requestedBy === "Sam Rahman" || role === "owner");

  const decide = (item, status) => {
    setApprovals(prev => prev.map(a => a.id === item.id ? { ...a, status } : a));
    if (status === "Approved" && item.type === "Rate change") {
      const match = item.title.match(/\+(\d+)%/);
      if (match) setRateMultiplier(v => Number((v * (1 + Number(match[1]) / 100)).toFixed(3)));
    }
    if (status === "Approved" && item.type === "Marketing") {
      if (item.title.toLowerCase().includes("pause meta")) setMetaPaused(true);
      if (item.title.toLowerCase().includes("resume meta")) setMetaPaused(false);
    }
    if (status === "Approved" && item.type === "Refund" && item.reservationRef) {
      setBookings(prev => prev.map(b => {
        if (b.id !== item.reservationRef) return b;
        const captured = Number(b.paid ?? (b.status === "Checked in" ? b.total : Math.round(Number(b.total || 0) * 0.2)));
        return { ...b, paid: Math.max(0, captured - Number(item.amount || 0)), lastRefund: Number(item.amount || 0) };
      }));
    }
    pushActivity(status === "Approved" ? "green" : "amber", item.title + " " + status.toLowerCase(), item.id + " · " + item.requestedBy);
    if (status === "Approved") emitHotelEvent("approval.approved", { item: { ...item, status: "Approved" } });
    flash(item.id + " " + status.toLowerCase());
  };

  const submit = e => {
    e.preventDefault();
    if (!draft.title.trim()) return flash("Add a request title");
    const item = {
      id: "APR-" + (105 + approvals.length),
      type: draft.type,
      title: draft.title.trim(),
      detail: draft.detail.trim() || "Manager request",
      amount: draft.amount ? Number(draft.amount) : null,
      requestedBy: "Sam Rahman",
      status: "Pending",
      time: "just now"
    };
    setApprovals(prev => [item, ...prev]);
    setDraft({ type: "Purchase order", title: "", detail: "", amount: "" });
    pushActivity("blue", "Approval request submitted", item.id + " · " + item.title);
    flash("Request sent to Owner");
  };

  return <>
    <PageHeader
      eyebrow={role === "owner" ? "Owner governance" : "Manager requests"}
      title={role === "owner" ? "Approval center" : "Requests & approvals"}
      text={role === "owner" ? "Review exceptional spend, rate changes, refunds and operating requests before they affect the property." : "Submit actions outside your operating authority and track the Owner’s decision."}
    />
    <section className="approval-summary">
      <div><span>Pending</span><b>{pending.length}</b><small>needs owner decision</small></div>
      <div><span>Approved</span><b>{approvals.filter(a => a.status === "Approved").length}</b><small>completed decisions</small></div>
      <div><span>Requested by you</span><b>{approvals.filter(a => a.requestedBy === "Sam Rahman").length}</b><small>manager requests</small></div>
    </section>

    <section className={"approval-layout " + (role === "manager" ? "with-form" : "")}>
      <article className="panel approval-list-panel">
        <div className="panel-head"><div><span className="panel-kicker">{role === "owner" ? "Decision queue" : "Request history"}</span><h3>{role === "owner" ? "Items needing review" : "Your submitted requests"}</h3></div><span className="instruction-count">{pending.length} pending</span></div>
        <div className="approval-list">
          {(role === "owner" ? approvals : myRequests).map(item => <div className="approval-item" key={item.id}>
            <span className={"approval-type " + item.type.toLowerCase().replaceAll(" ","-")}>{item.type}</span>
            <div className="approval-copy"><div><b>{item.title}</b><StatusDot status={item.status} /></div><p>{item.detail}</p><small>{item.id} · {item.requestedBy} · {item.time}</small></div>
            {item.amount != null && <strong>{fmt(item.amount)}</strong>}
            {role === "owner" && item.status === "Pending" ? <div className="approval-actions"><button className="ghost-btn" onClick={() => decide(item, "Rejected")}>Reject</button><button className="primary-btn" onClick={() => decide(item, "Approved")}><Check size={15} /> Approve</button></div> : <span className="approval-result">{item.status}</span>}
          </div>)}
        </div>
      </article>

      {role === "manager" && <aside className="panel request-form">
        <span className="panel-kicker">New request</span><h3>Ask for Owner approval</h3><p>Use this for spend, refunds or changes beyond your assigned authority.</p>
        <form onSubmit={submit}>
          <label>Request type<select value={draft.type} onChange={e => setDraft({...draft,type:e.target.value})}><option>Purchase order</option><option>Expense</option><option>Maintenance</option><option>Rate change</option><option>Refund</option><option>Marketing</option></select></label>
          <label>Title<input value={draft.title} onChange={e => setDraft({...draft,title:e.target.value})} placeholder="e.g. Weekend BAR +18%" /></label>
          <label>Details<textarea value={draft.detail} onChange={e => setDraft({...draft,detail:e.target.value})} placeholder="Why is this needed?" /></label>
          <label>Amount (optional)<div className="modal-money"><span>$</span><input type="number" min="0" value={draft.amount} onChange={e => setDraft({...draft,amount:e.target.value})} placeholder="0" /></div></label>
          <button className="primary-btn" type="submit"><Send size={15} /> Submit request</button>
        </form>
      </aside>}
    </section>
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
  const exportReport = () => {
    const esc = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
    const rows = [["ID","Date","Category","Vendor","Description","Amount","Status"], ...expenses.map(e => [e.id,e.date,e.category,e.vendor,e.note,e.amount,e.status])];
    const blob = new Blob([rows.map(row => row.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staypilot-expenses-sep-2026.csv";
    a.click();
    URL.revokeObjectURL(url);
    pushActivity("blue", "Expense report exported", expenses.length + " ledger entries · CSV");
    flash("Expense CSV exported");
  };

  return <>
    <PageHeader eyebrow="Owner finance" title="Operating expenses" text="Track property spending, approvals and budget consumption alongside hotel revenue." action={<button className="ghost-btn" onClick={exportReport}><ArrowUpRight size={16} /> Export CSV</button>} />
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

function GuestInbox({ bookings, pushActivity, flash, setActive, role, policy, emitHotelEvent }) {
  const seedThreads = [
    { id: "TH-1048", guest: "Olivia Martin", reservation: "SP-1048", source: "Booking.com", unread: 2, last: "Could we arrive around 13:30?", time: "4 min", messages: [
      { from: "hotel", text: "Hi Olivia, your Deluxe King is confirmed for Sep 23–26. We look forward to welcoming you.", time: "Yesterday · 18:20" },
      { from: "guest", text: "Thank you! Could we arrive around 13:30?", time: "4 min ago" }
    ]},
    { id: "TH-1046", guest: "Ava Garcia", reservation: "SP-1046", source: "Direct Website", unread: 0, last: "Perfect, thank you.", time: "22 min", messages: [
      { from: "hotel", text: "Your Sky Suite is confirmed. We have also noted the VIP welcome setup.", time: "Today · 10:12" },
      { from: "guest", text: "Perfect, thank you.", time: "22 min ago" }
    ]},
    { id: "TH-1047", guest: "Noah Williams", reservation: "SP-1047", source: "Airbnb", unread: 1, last: "Can I get two extra towels?", time: "31 min", messages: [
      { from: "guest", text: "Can I get two extra towels?", time: "31 min ago" }
    ]},
    { id: "TH-1045", guest: "Liam Chen", reservation: "SP-1045", source: "Expedia", unread: 0, last: "Check-in instructions received.", time: "1 hr", messages: [
      { from: "hotel", text: "Your check-in instructions are ready. Front desk is staffed 24 hours.", time: "1 hr ago" }
    ]}
  ];
  const [threads, setThreads] = useState(() => load("sp-guest-threads", seedThreads));
  const [selectedId, setSelectedId] = useState(() => threads[0]?.id || "");
  const [draft, setDraft] = useState("");
  useEffect(() => localStorage.setItem("sp-guest-threads", JSON.stringify(threads)), [threads]);
  useEffect(() => {
    const seen = new Set(load("sp-routed-guest-requests", []));
    const candidates = threads.filter(t => t.messages?.some(m => m.from === "guest" && /(extra towels?|towels?|clean|pillow|blanket|amenit)/i.test(m.text || "")));
    let changed = false;
    candidates.forEach(t => {
      if (seen.has(t.id)) return;
      const booking = bookings.find(b => b.id === t.reservation);
      const message = [...(t.messages || [])].reverse().find(m => m.from === "guest");
      const rawRequest = message?.text || "Guest service request";
      const request = /towels?/i.test(rawRequest) ? "Extra towels requested"
        : /pillow/i.test(rawRequest) ? "Extra pillows requested"
        : /blanket/i.test(rawRequest) ? "Extra blanket requested"
        : /clean/i.test(rawRequest) ? "Room cleaning requested"
        : rawRequest;
      const result = emitHotelEvent("guest.request_received", {
        booking,
        roomNumber: booking?.room,
        request
      });
      if (result?.ok) {
        seen.add(t.id);
        changed = true;
      }
    });
    if (changed) localStorage.setItem("sp-routed-guest-requests", JSON.stringify(Array.from(seen)));
  }, [threads, bookings]);

  const selected = threads.find(t => t.id === selectedId) || threads[0];
  const reservation = bookings.find(b => b.id === selected?.reservation);

  const selectThread = id => {
    setSelectedId(id);
    setThreads(prev => prev.map(t => t.id === id ? { ...t, unread: 0 } : t));
  };
  const send = text => {
    const clean = text.trim();
    if (!clean || !selected) return;
    if (role === "manager" && !policy.managerCanGuestMessage) return flash("Guest messaging is restricted by Owner policy");
    setThreads(prev => prev.map(t => t.id === selected.id ? {
      ...t,
      unread: 0,
      last: clean,
      time: "now",
      messages: [...t.messages, { from: "hotel", text: clean, time: "now" }]
    } : t));
    setDraft("");
    pushActivity("green", "Guest message sent", selected.guest + " · " + selected.reservation, "Guest messaging");
    flash("Message sent to " + selected.guest);
  };
  const templates = ["Your room is ready for arrival.", "What time do you expect to arrive?", "We’ve noted your request."];

  return <>
    <PageHeader eyebrow="Guest communication" title="Unified guest inbox" text="Keep reservation context beside every conversation so front desk and managers can respond without switching systems." action={<button className="ghost-btn" onClick={() => setActive("reservations")}><ClipboardCheck size={16} /> Reservations</button>} />
    <section className="inbox-layout panel">
      <aside className="thread-list">
        <div className="thread-list-head"><div><span className="panel-kicker">Conversations</span><h3>Guest messages</h3></div><span className="instruction-count">{threads.reduce((n,t)=>n+t.unread,0)} unread</span></div>
        <div className="thread-search"><Search size={15} /><span>Recent conversations</span></div>
        {threads.map(t => <button key={t.id} className={"thread-row " + (selected?.id === t.id ? "active" : "")} onClick={() => selectThread(t.id)}>
          <span className="guest-mini">{t.guest.split(" ").map(x=>x[0]).slice(0,2).join("")}</span>
          <div><div><b>{t.guest}</b><time>{t.time}</time></div><small>{t.source} · {t.reservation}</small><p>{t.last}</p></div>
          {t.unread > 0 && <em>{t.unread}</em>}
        </button>)}
      </aside>
      {selected && <section className="conversation-pane">
        <div className="conversation-head">
          <div><span className="guest-mini large">{selected.guest.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><div><b>{selected.guest}</b><small>{selected.source} · {selected.reservation}</small></div></div>
          <button className="ghost-btn" onClick={() => setActive("reservations")}>Open reservation <ArrowUpRight size={14} /></button>
        </div>
        {reservation && <div className="guest-context">
          <div><span>Stay</span><b>{reservation.checkIn} → {reservation.checkOut}</b></div>
          <div><span>Room</span><b>{reservation.room || "Unassigned"}</b></div>
          <div><span>Status</span><b>{reservation.status}</b></div>
          <div><span>Value</span><b>{fmt(reservation.total)}</b></div>
        </div>}
        <div className="conversation-messages">{selected.messages.map((m,i) => <div key={i} className={"guest-message " + m.from}><div>{m.text}</div><time>{m.time}</time></div>)}</div>
        <div className="message-templates">{templates.map(x => <button key={x} onClick={() => setDraft(x)}>{x}</button>)}</div>
        <form className="guest-composer" onSubmit={e => { e.preventDefault(); send(draft); }}><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a reply..." /><button className="primary-btn" type="submit"><Send size={16} /> Send</button></form>
      </section>}
    </section>
  </>;
}

function Channels({ rooms, stats, pushActivity, flash }) {
  const sellable = rooms.filter(roomSellable).length;
  const publishedRate = fmt(stats.adr);
  const displayChannels = channels.map(channel => ({ ...channel, inventory: sellable, rate: publishedRate }));
  const syncAll = () => {
    pushActivity("blue", "Channel reconciliation recorded", sellable + " sellable rooms · Booking.com · Airbnb · Expedia · Agoda · Direct", "Operations", "StayPilot distribution adapter");
    flash("Demo channel reconciliation recorded");
  };
  return <>
    <PageHeader eyebrow="Distribution" title="Channel Manager" text="Model rates and availability from one hotel state, then publish through approved provider adapters in production." action={<button className="primary-btn" onClick={syncAll}><RefreshCw size={16} /> Sync all channels</button>} />
    <div className="integration-hero panel">
      <div><span className="pulse-ring"><RefreshCw size={23} /></span><div><b>{sellable} rooms currently sellable</b><p>Availability is derived from occupancy, housekeeping and maintenance state. External OTA delivery is modeled in this portfolio build.</p></div></div>
      <div className="sync-stat"><b>{publishedRate}</b><span>current ADR model</span></div>
    </div>
    <section className="integration-grid">{displayChannels.map(c => <article className="panel integration-card" key={c.name}>
      <div className="integration-top"><span className={"channel-logo " + c.color}>{c.short}</span><div><b>{c.name}</b><span>{c.fee}</span></div><StatusDot status={c.sync} /></div>
      <div className="integration-metrics"><div><span>Sellable tonight</span><b>{c.inventory} rooms</b></div><div><span>Published rate</span><b>{c.rate}</b></div></div>
      <div className="integration-foot"><span><CheckCircle2 size={14} /> Inventory + rates connected</span><em>Configured in Connections</em></div>
    </article>)}</section>
    <div className="mini-note"><MessageSquare size={15} /> Provider access is configured under Integration Hub. This page uses shared hotel state; external OTA delivery remains simulated until partner APIs are connected.</div>
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

function Operations({ activities, role, pushActivity, flash, setActive, tasks, setTasks, rooms, setRooms, policy }) {
  const payments = [
    ["SP-1046", "Ava Garcia", "Direct Website", 1180, "Captured"],
    ["SP-1048", "Olivia Martin", "Booking.com", 684, "Secured"],
    ["SP-1043", "Ethan Lee", "Direct Website", 612, "Captured"]
  ];
  const complete = task => {
    if (role === "manager" && !policy.managerCanManageRooms && task.place.startsWith("Room ")) return flash("Room operations are restricted by Owner policy");
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "Completed" } : t));
    if (task.place === "Room 103" && task.team === "Housekeeping") {
      setRooms(prev => prev.map(r => r.number === "103" ? { ...r, housekeeping: "Clean" } : r));
    }
    pushActivity("green", task.place + " task completed", task.team + " · " + task.title);
    flash(task.place + " marked complete");
  };
  const resolveRoom207 = () => {
    if (role === "manager" && !policy.managerCanManageRooms) return flash("Room operations are restricted by Owner policy");
    setRooms(prev => prev.map(r => r.number === "207" ? { ...r, maintenance: "Clear" } : r));
    setTasks(prev => prev.map(t => t.place === "Room 207" ? { ...t, status: "Completed" } : t));
    pushActivity("green", "Room 207 maintenance resolved", "HVAC inspection completed · room block cleared");
    flash("Room 207 maintenance cleared");
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
          <div><span className="maintenance-severity high">High</span><div><b>Room 207 · HVAC inspection</b><small>Guest comfort · technician assigned</small></div><button className="row-action" onClick={resolveRoom207}>Resolve</button></div>
          <div><span className="maintenance-severity normal">Normal</span><div><b>Service lift · door sensor</b><small>Monitor during afternoon shift</small></div><button className="row-action" onClick={() => setActive("instructions")}>Handoff</button></div>
        </div>
      </article>}
    </section>

    <article className="panel ops-activity">
      <div className="panel-head"><div><span className="panel-kicker">Automation log</span><h3>Live system events</h3></div><span className="live-label"><i /> streaming</span></div>
      <div className="activity-list wide">{activities.map(a => <div className="activity-item" key={a.id}><span className={"activity-icon " + a.tone}><Wifi size={14} /></span><div><b>{a.title}</b><span>{a.meta}</span></div><time>{a.time}</time></div>)}</div>
    </article>
  </>;
}

function BookingEngine({ rooms, setRooms, bookings, setBookings, rateMultiplier, pushActivity, flash, setActive, emitHotelEvent }) {
  const [form, setForm] = useState({ guest: "", email: "", type: "Deluxe King", nights: 2, guests: 2 });
  const [success, setSuccess] = useState(null);
  const rates = { "City Queen": 149, "Deluxe King": 189, "Sky Suite": 279 };
  const rate = Math.round(rates[form.type] * rateMultiplier);
  const total = rate * Number(form.nights || 1);
  const physicalAvailable = rooms.filter(r => roomSellable(r) && r.type === form.type);
  const heldInventory = bookings.filter(b => b.type === form.type && b.room === "Unassigned" && !["Cancelled", "Checked out"].includes(b.status)).length;
  const availableCount = Math.max(0, physicalAvailable.length - heldInventory);
  const focusCheckout = () => document.querySelector(".checkout input")?.focus();

  const submit = e => {
    e.preventDefault();
    if (!form.guest.trim()) return flash("Add a guest name first");
    if (availableCount < 1) return flash("No sellable inventory available in this room type");
    const id = "SP-" + (1050 + bookings.length);
    const nights = Number(form.nights || 1);
    const booking = { id, guest: form.guest, paid: Math.round(total * 0.2), room: "Unassigned", type: form.type, source: "Direct Website", checkIn: "Today", checkOut: frontDeskDays[nights] || "After Sep 29", guests: Number(form.guests), total, status: "Confirmed" };
    setBookings(prev => [booking, ...prev]);
    emitHotelEvent("reservation.created", { booking });
    pushActivity("green", "New direct booking confirmed", id + " · " + form.type + " · room assignment pending · " + fmt(total));
    setSuccess(booking);
    flash("Reservation " + id + " created");
  };

  return <>
    <PageHeader eyebrow="Direct booking" title="A booking engine connected to live inventory." text="Guest bookings reserve room-type inventory immediately, then enter the Front Desk assignment queue for operational room allocation." />
    <div className="booking-demo">
      <section className="guest-site">
        <div className="guest-nav"><div className="hotel-logo"><span>N</span><div><b>Northstar</b><small>Grand Hotel</small></div></div><div><span>Rooms</span><span>Dining</span><span>Experience</span><button type="button" onClick={focusCheckout}>Book your stay</button></div></div>
        <div className="hero-visual"><div className="hero-copy"><span>Stay at the center of everything.</span><h2>City energy.<br />Quiet luxury.</h2><p>A refined stay designed around how you actually travel.</p><div className="rating">★★★★★ <span>4.8 · 218 guest reviews</span></div></div><div className="visual-card"><Moon size={36} /><span>Northstar Grand</span></div></div>
        <div className="booking-strip"><div><small>Check in</small><b>Sep 23</b></div><div><small>Check out</small><b>Sep 25</b></div><div><small>Guests</small><b>{form.guests} guests</b></div><button type="button" onClick={focusCheckout}>Check availability</button></div>
        <div className="guest-proof"><span><CheckCircle2 size={14} /> Best rate guarantee</span><span><CheckCircle2 size={14} /> Instant confirmation</span><span><CheckCircle2 size={14} /> Free changes up to 48h</span></div>
      </section>

      <aside className="checkout panel">
        <div className="checkout-head"><span className="panel-kicker">Live demo checkout</span><h3>Create a direct reservation</h3><p>Submit it, then open Front Desk to assign a physical room and complete check-in.</p></div>
        {success ? <div className="booking-success"><span><CheckCircle2 size={30} /></span><h3>Reservation confirmed</h3><p>{success.guest} · {success.type} · room assignment pending</p><div><b>{success.id}</b><b>{fmt(success.total)}</b></div><div className="success-actions"><button className="secondary-btn" onClick={() => setActive("reservations")}>View reservation <ArrowUpRight size={14} /></button><button className="ghost-btn" onClick={() => setActive("assistant")}><Sparkles size={14} /> Ask assistant</button></div><button className="text-link-btn" onClick={() => setSuccess(null)}>Create another booking</button></div> :
        <form onSubmit={submit}>
          <label>Guest name<input value={form.guest} onChange={e => setForm({ ...form, guest: e.target.value })} placeholder="e.g. Maya Thompson" /></label>
          <label>Email<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="guest@example.com" type="email" /></label>
          <div className="form-row"><label>Room type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>City Queen</option><option>Deluxe King</option><option>Sky Suite</option></select></label><label>Guests<select value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })}><option>1</option><option>2</option><option>3</option><option>4</option></select></label></div>
          <label>Nights<input min="1" max="6" type="number" value={form.nights} onChange={e => setForm({ ...form, nights: e.target.value })} /></label>
          <div className="availability-line"><span>{availableCount} rooms available</span><b>{fmt(rate)} / night</b></div>
          <div className="total-line"><span>Total stay</span><b>{fmt(total)}</b></div>
          <button className="primary-btn full" type="submit">Confirm demo booking <ArrowUpRight size={16} /></button>
          <small className="form-note"><CreditCard size={13} /> Payment is simulated for this portfolio prototype.</small>
        </form>}
      </aside>
    </div>
  </>;
}

function Assistant({ rooms, setRooms, bookings, stats, rateMultiplier, setRateMultiplier, metaPaused, setMetaPaused, approvals, setApprovals, pushActivity, flash, setActive, role, policy }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: role === "owner" ? "I can operate property, pricing and marketing controls within the Owner role." : "I can operate daily property controls. Actions outside Manager authority are routed to the Owner for approval." }
  ]);
  const [input, setInput] = useState("");

  const requestApproval = (type, title, detail, amount = null) => {
    const existing = approvals.find(a => a.status === "Pending" && a.title === title && a.requestedBy === "Sam Rahman");
    if (existing) return existing;
    const item = {
      id: "APR-" + (105 + approvals.length),
      type, title, detail, amount,
      requestedBy: "Sam Rahman",
      status: "Pending",
      time: "just now"
    };
    setApprovals(prev => [item, ...prev]);
    pushActivity("blue", "Assistant submitted approval request", item.id + " · " + title);
    return item;
  };

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
    const wantsReady = /\b(ready|available|release|released|open|inspected)\b/.test(lower);
    const wantsCleaning = /\b(cleaning|needs cleaning|dirty)\b/.test(lower);
    const rateMatch = lower.match(/(?:raise|increase).*(\d+)%/);

    if (roomNumber && !room) {
      reply = "I can’t find Room " + roomNumber + ", so I didn’t change property state.";
    } else if (room && role === "manager" && !policy.managerCanManageRooms && (wantsMaintenance || wantsReady || wantsCleaning)) {
      reply = "Room controls are restricted by Owner policy. I did not change Room " + roomNumber + ".";
    } else if (room && wantsMaintenance) {
      if (room.maintenance !== "Clear") {
        reply = "Room " + roomNumber + " already has a maintenance block. Its " + room.occupancy.toLowerCase() + " state was left unchanged.";
      } else {
        setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, maintenance: "Out of order" } : r));
        pushActivity("amber", "Assistant blocked Room " + roomNumber, "Maintenance · occupancy preserved · removed from sellable inventory");
        reply = "Done. Room " + roomNumber + " is Out of order for maintenance. I preserved its occupancy state (" + room.occupancy + ") and removed it from sellable inventory.";
      }
    } else if (room && wantsReady) {
      if (room.housekeeping === "Clean") {
        reply = "Room " + roomNumber + " is already housekeeping-ready. Occupancy remains " + room.occupancy + (room.maintenance === "Clear" ? "." : ", but a maintenance block still prevents sale.");
      } else {
        setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, housekeeping: "Clean" } : r));
        pushActivity("green", "Assistant marked Room " + roomNumber + " ready", "Housekeeping Clean · occupancy preserved");
        reply = "Done. Room " + roomNumber + " housekeeping is now Clean. Its occupancy remains " + room.occupancy + (room.maintenance === "Clear" && room.occupancy === "Vacant" ? ", so it is now sellable." : ".");
      }
    } else if (room && wantsCleaning) {
      setRooms(prev => prev.map(r => r.number === roomNumber ? { ...r, housekeeping: "Cleaning" } : r));
      pushActivity("amber", "Assistant sent Room " + roomNumber + " to cleaning", "Housekeeping queue · occupancy preserved");
      reply = "Room " + roomNumber + " is now in Cleaning. I preserved its " + room.occupancy.toLowerCase() + " state.";
    } else if (rateMatch) {
      const pct = Math.min(Number(rateMatch[1]), 30);
      const managerLimit = Number(policy.managerRateLimit || 0);
      if (role === "manager" && pct > managerLimit) {
        const item = requestApproval("Rate change", "BAR +" + pct + "%", "Requested through Operations Assistant · Manager limit is " + managerLimit + "%");
        reply = "A " + pct + "% rate increase exceeds your Manager limit of " + managerLimit + "%. I did not change rates; I submitted " + item.id + " to the Owner for approval.";
      } else {
        setRateMultiplier(v => Number((v * (1 + pct / 100)).toFixed(3)));
        pushActivity("blue", "Assistant adjusted BAR rates", "+" + pct + "% · synchronized to connected channels");
        reply = "Rates increased " + pct + "%. Current modeled ADR is approximately " + fmt(Math.round(stats.adr * (1 + pct / 100))) + ".";
      }
    } else if (lower.includes("pause") && lower.includes("meta")) {
      if (role === "manager" && !policy.managerCanMarketing) {
        const item = requestApproval("Marketing", "Pause Meta campaigns", "Requested through Operations Assistant · restricted by Owner policy");
        reply = "Marketing delivery is restricted by Owner policy. Meta remains " + (metaPaused ? "paused" : "active") + "; I submitted " + item.id + " for approval.";
      } else {
        setMetaPaused(true);
        pushActivity("violet", "Assistant paused Meta campaigns", "Owner action · all Meta campaigns paused");
        reply = "Meta campaigns are paused.";
      }
    } else if ((lower.includes("resume") || lower.includes("start")) && lower.includes("meta")) {
      if (role === "manager" && !policy.managerCanMarketing) {
        const item = requestApproval("Marketing", "Resume Meta campaigns", "Requested through Operations Assistant · restricted by Owner policy");
        reply = "Marketing delivery is restricted by Owner policy. I submitted " + item.id + " for approval and made no campaign change.";
      } else {
        setMetaPaused(false);
        pushActivity("violet", "Assistant resumed Meta campaigns", "Owner action · campaign delivery enabled");
        reply = "Meta campaigns are active again.";
      }
    } else if (lower.includes("sync")) {
      if (role === "manager" && !policy.managerCanSyncChannels) {
        reply = "Channel reconciliation is restricted by Owner policy. I did not trigger a sync.";
      } else {
        pushActivity("blue", "Assistant triggered channel sync", "5 channels acknowledged · no conflicts");
        reply = "Channel reconciliation completed. Booking.com, Airbnb, Expedia, Agoda and Direct match the current sellable inventory.";
      }
    } else if (lower.includes("arrival")) {
      const arr = bookings.filter(b => b.checkIn === "Today" && !["Cancelled","Checked out"].includes(b.status));
      reply = "There are " + arr.length + " arrivals today: " + arr.map(b => b.guest + " · " + (b.room === "Unassigned" ? "room unassigned" : "Room " + b.room)).join(", ") + ".";
    } else if (lower.includes("occupancy")) {
      reply = "Current physical occupancy is " + stats.occupancy + "%. " + stats.available + " clean, unblocked rooms are sellable now.";
    } else if (lower.includes("revenue")) {
      reply = role === "owner"
        ? "Today’s modeled gross room revenue is " + fmt(stats.revenue) + ". ADR is " + fmt(stats.adr) + " and RevPAR is " + fmt(stats.revpar) + "."
        : "Revenue detail is Owner-level information. I can summarize arrivals, room readiness, maintenance and inventory for your shift.";
    } else if (lower.includes("booking") || lower.includes("reservation")) {
      const unassigned = bookings.filter(b => b.room === "Unassigned" && !["Cancelled","Checked out"].includes(b.status)).length;
      reply = "There are " + bookings.length + " reservations in the demo ledger and " + unassigned + " currently waiting for room assignment. Open Front desk calendar for assignment and check-in controls.";
    } else if (lower.includes("what needs") || lower.includes("attention")) {
      const maintenance = rooms.filter(r => r.maintenance !== "Clear").map(r => r.number);
      const cleaning = rooms.filter(r => r.housekeeping !== "Clean").map(r => r.number);
      const pending = approvals.filter(a => a.status === "Pending").length;
      reply = "Priority check: " + (maintenance.length ? "maintenance in room " + maintenance.join(", ") + "; " : "") + (cleaning.length ? "housekeeping pending in room " + cleaning.join(", ") + "; " : "") + pending + " approval item" + (pending === 1 ? "" : "s") + " pending.";
    } else {
      reply = role === "owner"
        ? "Try “show today’s arrivals”, “block room 207”, “mark room 103 ready”, “raise rates 8%”, “sync all channels”, or “pause Meta ads”."
        : "Try “show today’s arrivals”, “mark room 103 ready”, “raise rates 8%”, “raise rates 18%” to request approval, or “sync all channels”.";
    }
    setTimeout(() => setMessages(m => [...m, { role: "assistant", text: reply }]), 250);
  };

  const quick = role === "owner"
    ? ["What needs attention?", "Show today’s arrivals", "Raise rates 8%", "Sync all channels", metaPaused ? "Resume Meta ads" : "Pause Meta ads", "Mark room 103 ready"]
    : ["What needs attention?", "Show today’s arrivals", "Mark room 103 ready", "Raise rates 8%", "Raise rates 18%", "Sync all channels"];

  return <div className="assistant-page">
    <PageHeader eyebrow="Operations assistant" title="Operate the property with commands." text={role === "owner" ? "Owner-authorized commands can operate property, rate and marketing controls." : "Manager commands operate daily property controls; exceptional actions are routed to Owner approval."} action={<div className="assistant-online"><span /> Permission-aware control layer</div>} />
    <div className="assistant-layout">
      <section className="assistant-chat panel">
        <div className="chat-head"><div className="ai-orb"><Bot size={19} /></div><div><b>StayPilot Operations</b><span>{role === "owner" ? "Owner authority" : "Manager authority · approval routing enabled"}</span></div><span className="live-label"><i /> online</span></div>
        <div className="messages">{messages.map((m, i) => <div className={"message " + m.role} key={i}>{m.role === "assistant" && <span className="mini-orb"><Bot size={13} /></span>}<div>{m.text}</div></div>)}</div>
        <div className="quick-prompts">{quick.map(q => <button key={q} onClick={() => act(q)}>{q}</button>)}</div>
        <form className="composer" onSubmit={e => { e.preventDefault(); act(input); }}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask or tell StayPilot what to do..." /><button><Send size={17} /></button></form>
      </section>
      <aside className="assistant-side">
        <article className="panel command-card"><span className="panel-kicker">Current authority</span><h3>{role === "owner" ? "Owner control scope" : "Manager control scope"}</h3>
          <div className="tool-list">
            <div><CalendarDays size={16} /><span>Reservations & rooms</span><b>Operate</b></div>
            <div><BedDouble size={16} /><span>Housekeeping / maintenance</span><b>Operate</b></div>
            <div><RefreshCw size={16} /><span>Channel sync</span><b>{role === "owner" || policy.managerCanSyncChannels ? "Operate" : "Restricted"}</b></div>
            <div><DollarSign size={16} /><span>Rate changes</span><b>{role === "owner" ? "Full" : "≤ " + policy.managerRateLimit + "%"}</b></div>
            <div><Megaphone size={16} /><span>Marketing</span><b>{role === "owner" || policy.managerCanMarketing ? "Operate" : "Approval"}</b></div>
          </div>
        </article>
        <article className="panel assistant-tip"><span><ShieldCheck size={19} /></span><h3>Permission-safe actions.</h3><p>Commands use the same room state and approval queue as the rest of StayPilot. Restricted actions are requested, not silently executed.</p><button className="secondary-btn" onClick={() => setActive(role === "owner" ? "approvals" : "frontdesk")}>{role === "owner" ? "Open approvals" : "Open front desk"} <ArrowUpRight size={14} /></button></article>
      </aside>
    </div>
  </div>;
}

function AutomationCenter({ role, pushActivity, flash, policy, automationRules, setAutomationRules, automationLogs, automationMaster, setAutomationMaster, automationQueue, emitHotelEvent }) {
  const [scopeFilter, setScopeFilter] = useState("All");
  const [runFilter, setRunFilter] = useState("All");

  const roleRules = role === "owner" ? automationRules : automationRules.filter(r => r.scope === "Operations");
  const roleLogs = role === "owner" ? automationLogs : automationLogs.filter(log => {
    const rule = automationRules.find(r => r.id === log.ruleId);
    return rule?.scope === "Operations";
  });
  const scopes = ["All", ...Array.from(new Set(roleRules.map(r => r.scope)))];
  const visibleRules = scopeFilter === "All" ? roleRules : roleRules.filter(r => r.scope === scopeFilter);
  const visibleLogs = roleLogs.filter(log => {
    const rule = automationRules.find(r => r.id === log.ruleId);
    if (scopeFilter !== "All" && rule?.scope !== scopeFilter) return false;
    if (runFilter === "Failures") return log.result === "Failed";
    if (runFilter === "Approvals") return log.result === "Approval";
    return true;
  });
  const minutesSaved = roleRules.reduce((n, r) => n + Number(r.minutesSaved || 0), 0);

  const toggle = rule => {
    if (role === "manager" && (!policy.managerCanOperateAutomations || rule.scope !== "Operations")) return flash("Owner permission required");
    const next = rule.status === "Active" ? "Paused" : "Active";
    setAutomationRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: next } : r));
    pushActivity(next === "Active" ? "green" : "amber", rule.name + " " + next.toLowerCase(), rule.id + " · automation control", "Automation");
    flash(rule.name + " " + next.toLowerCase());
  };

  const setAutonomy = (rule, autonomy) => {
    if (role !== "owner") return flash("Only the Owner can change automation authority");
    setAutomationRules(prev => prev.map(r => r.id === rule.id ? { ...r, autonomy } : r));
    pushActivity("blue", rule.name + " authority updated", rule.id + " · " + autonomy, "Governance");
    flash(rule.name + " authority: " + autonomy);
  };

  const runNow = rule => {
    if (role === "manager" && !policy.managerCanOperateAutomations) return flash("Operational automation control is restricted by Owner policy");
    if (rule.status !== "Active") return flash("Enable the automation before running it");
    const result = emitHotelEvent(rule.event, { manual: true, ruleId: rule.id });
    if (result?.ok) flash(rule.name + " executed against shared hotel state");
    else if (result?.reason) flash(result.reason);
  };

  const toggleMaster = () => {
    if (role !== "owner") return flash("Only the Owner can pause all automations");
    const next = automationMaster === "Paused" ? "Active" : "Paused";
    setAutomationMaster(next);
    pushActivity(
      next === "Paused" ? "amber" : "green",
      next === "Paused" ? "Automation master pause enabled" : "Automation master pause cleared",
      next === "Paused" ? "All automation execution blocked until Owner resumes" : "State-triggered workflows can execute again",
      "Governance"
    );
    flash(next === "Paused" ? "All automations paused" : "Automations resumed");
  };

  return <>
    <PageHeader eyebrow="Automation" title="Property automation center" text={role === "owner" ? "Run policy-aware hotel workflows against shared property state, with execution traces and human approvals where required." : "Operate day-to-day hotel automations within the authority configured by the Owner."} />
    <section className={"automation-master-banner " + (automationMaster === "Paused" ? "paused" : "active")}>
      <div><span className="master-status-dot" /><div><span className="panel-kicker">Global safety control</span><h3>{automationMaster === "Paused" ? "All automation execution is paused" : "Automation execution is active"}</h3><p>{automationMaster === "Paused" ? "Inbound hotel events are queued and state triggers are deferred. Rule settings and hotel state are preserved." : "Rules execute only within their configured autonomy and Owner policy limits."}</p>{automationMaster === "Paused" && <span className="automation-queue-count">{automationQueue.length} queued event{automationQueue.length === 1 ? "" : "s"}</span>}</div></div>
      {role === "owner" ? <button className={automationMaster === "Paused" ? "primary-btn" : "danger-ghost-btn"} onClick={toggleMaster}>{automationMaster === "Paused" ? <><Play size={15}/> Resume automations</> : <><ShieldCheck size={15}/> Pause all automations</>}</button> : <span className="master-readonly">{automationMaster}</span>}
    </section>
    <section className="automation-summary">
      <div><span>Active rules</span><b>{roleRules.filter(r=>r.status==="Active").length}</b><small>event-driven workflows</small></div>
      <div><span>Runs</span><b>{roleRules.reduce((n,r)=>n+Number(r.runs||0),0)}</b><small>recorded executions</small></div>
      <div><span>Estimated time saved</span><b>{(minutesSaved / 60).toFixed(1)}h</b><small>{minutesSaved} staff minutes avoided</small></div>
      <div><span>Failures</span><b>{roleRules.reduce((n,r)=>n+Number(r.failures||0),0)}</b><small>surfaced for review</small></div>
    </section>
    <div className="automation-filter-bar">
      <div><span>Workflow scope</span>{scopes.map(scope => <button key={scope} className={scopeFilter === scope ? "active" : ""} onClick={() => setScopeFilter(scope)}>{scope}</button>)}</div>
      <div><span>Run history</span>{["All","Failures","Approvals"].map(filter => <button key={filter} className={runFilter === filter ? "active" : ""} onClick={() => setRunFilter(filter)}>{filter}</button>)}</div>
    </div>
    <section className="automation-layout">
      <div className="automation-rule-list">
        {visibleRules.map(rule => <article className="panel automation-rule" key={rule.id}>
          <div className="automation-rule-head"><div><span className="rule-scope">{rule.scope}</span><h3>{rule.name}</h3><small>{rule.id} · {rule.event}</small></div><button className={"toggle-switch " + (rule.status === "Active" ? "on" : "")} onClick={() => toggle(rule)}><i /></button></div>
          <div className="automation-flow"><div><span>IF</span><b>{rule.trigger}</b></div><ArrowUpRight size={16} /><div><span>THEN</span><b>{rule.action}</b></div></div>
          <div className="automation-authority"><span>Autonomy</span>{role === "owner" ? <select value={rule.autonomy || "Auto"} onChange={e => setAutonomy(rule, e.target.value)}><option>Auto</option><option>Policy</option><option>Approval</option><option>Suggest</option></select> : <b>{rule.autonomy || "Auto"}</b>}</div>
          <div className="automation-rule-foot"><span>Last run <b>{rule.last}</b></span><span>{rule.runs} runs · {rule.failures} failures</span><button className="row-action" onClick={() => runNow(rule)}>Run workflow</button></div>
        </article>)}
      </div>
      <aside className="panel automation-log-panel">
        <div className="panel-head"><div><span className="panel-kicker">Execution history</span><h3>Real workflow traces</h3></div></div>
        <div className="automation-log">{visibleLogs.slice(0,10).map(log => <div key={log.id}>
          <span className={"automation-result " + String(log.result).toLowerCase()}><i />{log.result}</span>
          <div><b>{log.rule}</b><small>{log.detail}</small>{log.steps?.length ? <small>{log.steps.join(" → ")}</small> : null}</div>
          <time>{log.duration ? log.duration + " ms" : log.time}</time>
        </div>)}</div>
      </aside>
    </section>
  </>;
}

function AuditLog({ activities, role }) {
  const [filter, setFilter] = useState("All");
  const categories = ["All", "Operations", "Automation", "Guest messaging", "Governance", "System"];
  const rows = activities.filter(a => filter === "All" || (a.category || "Operations") === filter);
  return <>
    <PageHeader eyebrow="Governance" title="Audit log" text="Trace human, system and automation actions across the shared hotel state." />
    <div className="audit-toolbar"><div className="segmented">{categories.map(x => <button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div><span className="audit-role"><ShieldCheck size={14} /> Viewing as {role === "owner" ? "Owner" : "Manager"}</span></div>
    <article className="panel audit-panel">
      <div className="audit-list">{rows.map(a => <div className="audit-row" key={a.id}>
        <span className={"activity-icon " + a.tone}><Clock3 size={14} /></span>
        <div><div><b>{a.title}</b><span className="audit-category">{a.category || "Operations"}</span></div><p>{a.meta}</p><small>{a.actor || "StayPilot system"}</small></div>
        <time>{a.time}</time>
      </div>)}</div>
    </article>
  </>;
}

function RolePolicy({ policy, setPolicy, flash, pushActivity }) {
  const toggle = key => {
    const next = !policy[key];
    setPolicy(prev => ({ ...prev, [key]: next }));
    pushActivity("blue", "Manager permission updated", key + " · " + (next ? "allowed" : "restricted"), "Governance");
    flash("Manager policy updated");
  };
  const updateLimit = (key, value) => {
    const next = Math.max(0, Number(value) || 0);
    setPolicy(prev => ({ ...prev, [key]: next }));
  };
  const permissions = [
    ["managerCanManageRooms", "Rooms & housekeeping", "Change housekeeping and maintenance state"],
    ["managerCanSyncChannels", "Channel reconciliation", "Trigger inventory/rate synchronization"],
    ["managerCanManageInventory", "Supply inventory", "Adjust stock and submit purchase requests"],
    ["managerCanGuestMessage", "Guest messaging", "Reply to guest conversations"],
    ["managerCanOperateAutomations", "Operational automations", "Run and pause Operations-scoped rules"],
    ["managerCanMarketing", "Marketing control", "Pause/resume campaigns without Owner approval"]
  ];
  return <>
    <PageHeader eyebrow="Owner governance" title="Roles & permissions" text="Define Manager operating authority and approval thresholds. These policies are used by the Operations Assistant and role-aware controls." />
    <section className="policy-layout">
      <article className="panel role-policy-card">
        <div className="policy-person"><span className="avatar">SR</span><div><span className="panel-kicker">Property Manager</span><h3>Sam Rahman</h3><p>Daily hotel operations with Owner-defined financial and system boundaries.</p></div></div>
        <div className="permission-list">{permissions.map(([key,label,desc]) => <div key={key}><div><b>{label}</b><small>{desc}</small></div><button className={"toggle-switch " + (policy[key] ? "on" : "")} onClick={() => toggle(key)}><i /></button></div>)}</div>
      </article>
      <aside className="panel threshold-card">
        <span className="panel-kicker">Approval thresholds</span><h3>Manager financial authority</h3><p>Actions above these limits become Owner approval requests.</p>
        <label>Rate adjustment limit <div><input type="number" min="0" max="30" value={policy.managerRateLimit} onChange={e => updateLimit("managerRateLimit",e.target.value)} /><span>%</span></div></label>
        <label>Refund limit <div><span>$</span><input type="number" min="0" max="1000" value={policy.managerRefundLimit} onChange={e => updateLimit("managerRefundLimit",e.target.value)} /></div></label>
        <label>Unapproved purchase limit <div><span>$</span><input type="number" min="0" max="2000" value={policy.managerPurchaseLimit} onChange={e => updateLimit("managerPurchaseLimit",e.target.value)} /></div></label>
        <div className="policy-note"><ShieldCheck size={16} /><span>Production permissions would be server-enforced RBAC. This prototype applies the policy to shared client-side controls.</span></div>
      </aside>
    </section>
  </>;
}

function ExceptionCenter({ rooms, bookings, approvals, role, setActive, flash, pushActivity }) {
  const [systemIssues, setSystemIssues] = useState(() => load("sp-exceptions", seedSystemExceptions));
  useEffect(() => localStorage.setItem("sp-exceptions", JSON.stringify(systemIssues)), [systemIssues]);

  const dynamic = [
    ...rooms.filter(r => r.maintenance !== "Clear").map(r => ({ id:"ROOM-"+r.number, type:"Maintenance", severity:"High", title:"Room "+r.number+" out of order", detail:r.type+" · "+r.occupancy+" · maintenance block", route:"rooms", status:"Open", dynamic:true })),
    ...rooms.filter(r => r.occupancy === "Reserved" && r.housekeeping !== "Clean").map(r => ({ id:"READY-"+r.number, type:"Readiness", severity:"High", title:"Reserved room "+r.number+" is not ready", detail:r.housekeeping+" · arrival risk", route:"rooms", status:"Open", dynamic:true })),
    ...bookings.filter(b => b.room === "Unassigned" && !["Cancelled","Checked out"].includes(b.status)).map(b => ({ id:"ASSIGN-"+b.id, type:"Front desk", severity:"Normal", title:b.guest+" needs room assignment", detail:b.id+" · "+b.type+" · "+b.checkIn, route:"frontdesk", status:"Open", dynamic:true })),
    ...(role === "owner" ? approvals.filter(a => a.status === "Pending").map(a => ({ id:"APP-"+a.id, type:"Approval", severity:"Normal", title:a.title+" awaiting decision", detail:a.id+" · requested by "+a.requestedBy, route:"approvals", status:"Open", dynamic:true })) : [])
  ];
  const visibleSystemIssues = role === "owner" ? systemIssues : systemIssues.filter(x => x.type !== "Distribution");
  const issues = [...dynamic, ...visibleSystemIssues.filter(x => x.status === "Open")];
  const resolveSystem = issue => {
    setSystemIssues(prev => prev.map(x => x.id === issue.id ? { ...x, status:"Resolved" } : x));
    pushActivity("green", issue.title + " resolved", issue.id + " · exception closed", "Operations");
    flash("Exception resolved");
  };

  return <>
    <PageHeader eyebrow="Attention center" title="Exceptions & blockers" text="Surface only the conditions that need a human decision, operational fix or follow-up." />
    <section className="exception-summary">
      <div><span>Open issues</span><b>{issues.length}</b><small>across current demo state</small></div>
      <div><span>High priority</span><b>{issues.filter(x=>x.severity==="High").length}</b><small>needs prompt action</small></div>
      <div><span>Room related</span><b>{issues.filter(x=>["Maintenance","Readiness"].includes(x.type)).length}</b><small>affects sellability/readiness</small></div>
    </section>
    <article className="panel exception-panel">
      <div className="exception-list">{issues.length ? issues.map(issue => <div className="exception-row" key={issue.id}>
        <span className={"exception-severity "+issue.severity.toLowerCase()}>{issue.severity}</span>
        <div><span className="exception-type">{issue.type}</span><b>{issue.title}</b><p>{issue.detail}</p></div>
        <div className="exception-actions"><button className="ghost-btn" onClick={() => setActive(issue.route)}>Open</button>{!issue.dynamic && <button className="row-action" onClick={() => resolveSystem(issue)}>Resolve</button>}</div>
      </div>) : <div className="empty-state"><CheckCircle2 size={28} /><b>No active exceptions</b><span>The current property state has no unresolved blockers.</span></div>}</div>
    </article>
  </>;
}

function PropertySetup({ policy, setPolicy, setActive, pushActivity, flash }) {
  const defaults = {
    property: true,
    pms: false,
    messaging: false,
    finance: false,
    team: true,
    automation: false
  };
  const [setup, setSetup] = useState(() => load("sp-property-setup", defaults));
  useEffect(() => localStorage.setItem("sp-property-setup", JSON.stringify(setup)), [setup]);
  const steps = [
    ["property", "Property profile", "Northstar Grand · 24 rooms · Chattogram", Building2],
    ["pms", "Connect existing PMS / channel source", "Import reservations, rooms, availability and guest state", Database],
    ["messaging", "Connect guest messaging", "WhatsApp Business or email provider", MessageSquare],
    ["finance", "Connect finance", "Payments + accounting journal / settlement destination", ReceiptText],
    ["team", "Invite operating team", "Owner and Manager authority model configured", UserCog],
    ["automation", "Choose automation authority", "Auto, policy-limited, approval or suggest-only per workflow", Zap]
  ];
  const completed = steps.filter(([key]) => setup[key]).length;
  const toggle = (key, label) => {
    const next = !setup[key];
    setSetup(prev => ({ ...prev, [key]: next }));
    pushActivity(next ? "green" : "amber", label + (next ? " completed" : " reopened"), "Property onboarding · " + label, "Governance");
    flash(next ? label + " marked complete" : label + " reopened");
  };
  const applySafeDefaults = () => {
    setPolicy(prev => ({ ...prev, managerRateLimit: 10, managerRefundLimit: 100, managerPurchaseLimit: 150 }));
    setSetup(prev => ({ ...prev, automation: true }));
    pushActivity("green", "Automation safety defaults applied", "± policy thresholds · approvals above limits", "Governance");
    flash("Safe automation defaults applied");
  };
  return <>
    <PageHeader eyebrow="Owner onboarding" title="Get value without replacing your hotel stack" text="Connect the systems the property already uses, import operating context, choose authority limits, and let StayPilot automate the work between them." action={<button className="ghost-btn" onClick={() => setActive("connections")}><PlugZap size={16} /> Open integration hub</button>} />
    <section className="automation-summary">
      <div><span>Setup progress</span><b>{completed}/{steps.length}</b><small>{Math.round(completed/steps.length*100)}% configured</small></div>
      <div><span>Property</span><b>24 rooms</b><small>Northstar Grand demo</small></div>
      <div><span>Manager rate authority</span><b>±{policy.managerRateLimit}%</b><small>above limit → approval</small></div>
      <div><span>Automation mode</span><b>{setup.automation ? "Ready" : "Review"}</b><small>human-in-the-loop controls</small></div>
    </section>
    <section className="policy-layout">
      <article className="panel role-policy-card">
        <div className="panel-head"><div><span className="panel-kicker">Guided setup</span><h3>Property readiness</h3></div></div>
        <div className="permission-list">{steps.map(([key,label,desc,Icon]) => <div key={key}>
          <div className="setup-step-icon"><Icon size={17} /></div>
          <div><b>{label}</b><small>{desc}</small></div>
          <button className={"toggle-switch " + (setup[key] ? "on" : "")} onClick={() => toggle(key,label)}><i /></button>
        </div>)}</div>
      </article>
      <aside className="panel threshold-card">
        <span className="panel-kicker">Recommended start</span><h3>Controlled automation</h3><p>Start with routine actions on Auto. Keep financial, pricing and guest-impacting actions inside explicit limits or Owner approval.</p>
        <div className="scope-block"><span>Suggested first automations</span><div><em><Check size={13}/>Reservation intake</em><em><Check size={13}/>Checkout turnover</em><em><Check size={13}/>Room ready</em><em><Check size={13}/>Low-stock policy</em></div></div>
        <button className="primary-btn full" onClick={applySafeDefaults}><ShieldCheck size={16}/> Apply safe defaults</button>
        <button className="ghost-btn full" onClick={() => setActive("automations")}><Zap size={16}/> Review automation authority</button>
      </aside>
    </section>
  </>;
}

function Connections({ pushActivity, flash, emitHotelEvent }) {
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
    pms: {
      name: "Existing PMS bridge", icon: "PMS", tone: "green", type: "Property system", note: "Connect the hotel system you already use; StayPilot acts as the automation layer above it.",
      fields: [
        ["baseUrl", "PMS API base URL", "https://pms.example.com/api", "text"],
        ["propertyId", "Property ID", "property_123", "text"],
        ["apiKey", "API / OAuth credential", "Enter connector credential", "secret"]
      ],
      scopes: ["Reservations", "Rooms & availability", "Guest profiles", "Folio events"]
    },
    quickbooks: {
      name: "QuickBooks / Accounting", icon: "QB", tone: "green", type: "Finance", note: "Journal, revenue, tax, expense and settlement export adapter.",
      fields: [
        ["companyId", "Company / tenant ID", "company_123", "text"],
        ["clientId", "OAuth Client ID", "Accounting app client ID", "text"],
        ["clientSecret", "OAuth Client Secret", "Enter OAuth secret", "secret"]
      ],
      scopes: ["Journal entries", "Expenses", "Taxes", "Settlement reconciliation"]
    },
    whatsapp: {
      name: "WhatsApp Business", icon: "WA", tone: "green", type: "Communications", note: "Guest confirmations, arrival instructions, service updates and approved recovery messages.",
      fields: [
        ["phoneId", "Phone Number ID", "123456789", "text"],
        ["businessId", "Business Account ID", "987654321", "text"],
        ["accessToken", "Access Token", "Enter system-user token", "secret"],
        ["verifyToken", "Webhook Verify Token", "Enter webhook verification token", "secret"]
      ],
      scopes: ["Guest messages", "Delivery receipts", "Inbound replies"]
    },
    webhooks: {
      name: "Webhooks & REST API", icon: "</>", tone: "blue", type: "Developer tools", note: "StayPilot-native integration surface. n8n, Make, Zapier or custom systems can consume it, but none are required.",
      fields: [
        ["endpoint", "Outbound destination", "https://your-system.example/staypilot", "text"],
        ["signingSecret", "HMAC signing secret", "Generated server-side in production", "secret"],
        ["events", "Subscribed events", "reservation.created, guest.checked_out", "text"]
      ],
      scopes: ["Signed outbound events", "Inbound hotel events", "Retries", "Idempotency", "Delivery replay"]
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
  const [testingAll, setTestingAll] = useState(false);
  const [lastDemoCheck, setLastDemoCheck] = useState("Not run");
  const [webhookEndpoints, setWebhookEndpoints] = useState(() => load("sp-webhook-endpoints", [
    { id:"WH-01", name:"Accounting event sink", url:"https://example-accounting.test/staypilot", events:["payment.captured","guest.checked_out"], status:"Active", deliveries:48, last:"3 min ago", success:"100%" },
    { id:"WH-02", name:"Operations notifications", url:"https://example-ops.test/hooks", events:["room.maintenance_blocked","inventory.low_stock"], status:"Active", deliveries:19, last:"22 min ago", success:"94.7%" }
  ]));
  const [webhookDeliveries, setWebhookDeliveries] = useState(() => load("sp-webhook-deliveries", [
    { id:"DLV-402", endpoint:"WH-01", event:"guest.checked_out", code:"200 OK", duration:"184 ms", time:"3 min ago" },
    { id:"DLV-401", endpoint:"WH-02", event:"room.maintenance_blocked", code:"200 OK", duration:"241 ms", time:"22 min ago" }
  ]));
  useEffect(() => localStorage.setItem("sp-webhook-endpoints", JSON.stringify(webhookEndpoints)), [webhookEndpoints]);
  useEffect(() => localStorage.setItem("sp-webhook-deliveries", JSON.stringify(webhookDeliveries)), [webhookDeliveries]);
  const [testEvent, setTestEvent] = useState("guest.request_received");
  const provider = providers[selected];
  const webhook = "https://api.staypilot.demo/webhooks/" + selected;

  const updateValue = (key, value) => setValues(prev => ({ ...prev, [selected + "." + key]: value }));
  const getValue = key => values[selected + "." + key] || "";

  const testConnection = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setConnected(prev => ({ ...prev, [selected]: true }));
      pushActivity("green", provider.name + " demo connection test passed", environment + " · simulated provider handshake");
      flash(provider.name + " demo connection test passed");
    }, 750);
  };

  const save = () => {
    pushActivity("blue", provider.name + " configuration staged", "Demo only · production secrets belong in server vault");
    flash("Configuration staged for secure server-side storage");
  };

  const testAll = () => {
    setTestingAll(true);
    setTimeout(() => {
      setTestingAll(false);
      setLastDemoCheck("just now");
      pushActivity("green", "Integration demo checks completed", "Webhook, token renewal, conversion export and retry policy simulated");
      flash("Demo integration checks completed");
    }, 850);
  };

  const copyWebhook = async () => {
    try { await navigator.clipboard.writeText(webhook); flash("Webhook URL copied"); }
    catch { flash("Webhook URL ready to copy"); }
  };

  const replayWebhook = endpoint => {
    const delivery = { id:"DLV-"+String(Date.now()).slice(-5), endpoint:endpoint.id, event:endpoint.events[0] || "reservation.created", code:"200 OK", duration:(160 + Date.now()%180) + " ms", time:"now" };
    setWebhookDeliveries(prev => [delivery, ...prev].slice(0, 30));
    setWebhookEndpoints(prev => prev.map(x => x.id === endpoint.id ? { ...x, deliveries:Number(x.deliveries||0)+1, last:"now", success:"100%" } : x));
    pushActivity("green", "Webhook replay simulated", endpoint.name + " · " + delivery.event + " · " + delivery.code, "Automation", "StayPilot integration gateway");
    flash("Demo webhook replay recorded");
  };

  const sendInboundTest = () => {
    const payloads = {
      "guest.request_received": { request:"Extra pillows requested" },
      "review.negative": { guest:"Demo Guest", score:2 },
      "payment.failed": {},
      "prearrival.due": {},
      "occupancy.threshold": { adjustment:12 }
    };
    const result = emitHotelEvent(testEvent, { ...(payloads[testEvent] || {}) });
    if (result?.ok) {
      pushActivity("blue", "Inbound test event accepted", testEvent + " · normalized by Integration Hub", "Automation", "StayPilot integration gateway");
      flash("Inbound event executed: " + testEvent);
    } else if (result?.queued) {
      pushActivity("amber", "Inbound test event queued", testEvent + " · waiting for Owner resume", "Automation", "StayPilot integration gateway");
      flash("Inbound event queued while automations are paused");
    } else {
      flash(result?.reason || "Inbound test could not execute");
    }
  };

  return <>
    <PageHeader
      eyebrow="System administration"
      title="Integration hub"
      text="Connect the hotel systems you already use. StayPilot normalizes their events, runs policy-aware automations, and exposes signed webhooks/API for everything else."
      action={<div className="connection-security"><ShieldCheck size={17} /><div><b>Secrets vault</b><span>Server-side in production</span></div></div>}
    />

    <section className="connections-summary">
      <div><span className="summary-icon"><PlugZap size={19} /></span><div><b>{Object.values(connected).filter(Boolean).length} demo-connected</b><span>of {Object.keys(providers).length} integration surfaces</span></div></div>
      <div><span className="summary-icon safe"><ShieldCheck size={19} /></span><div><b>Encrypted secrets</b><span>KMS / environment vault</span></div></div>
      <div><span className="summary-icon"><Database size={19} /></span><div><b>Webhook intake</b><span>Signed + idempotent events</span></div></div>
      <div className="environment-switch"><span>Environment</span><div>{["Sandbox", "Production"].map(x => <button key={x} className={environment === x ? "active" : ""} onClick={() => setEnvironment(x)}>{x}</button>)}</div></div>
    </section>

    <section className="owner-field-grid integration-marketplace">
      <button className="panel owner-field" onClick={() => setSelected("pms")}><span className="field-icon"><Database size={19} /></span><div><span>Existing PMS</span><b>Bridge, don’t replace</b><small>reservations, rooms, folios & guests</small></div><ArrowUpRight size={15} /></button>
      <button className="panel owner-field" onClick={() => setSelected("quickbooks")}><span className="field-icon"><ReceiptText size={19} /></span><div><span>Accounting</span><b>QuickBooks / ledger</b><small>journals, tax, expenses & settlement</small></div><ArrowUpRight size={15} /></button>
      <button className="panel owner-field" onClick={() => setSelected("whatsapp")}><span className="field-icon"><MessageSquare size={19} /></span><div><span>Guest messaging</span><b>WhatsApp Business</b><small>confirmations, arrival & service flows</small></div><ArrowUpRight size={15} /></button>
      <button className="panel owner-field" onClick={() => setSelected("webhooks")}><span className="field-icon"><PlugZap size={19} /></span><div><span>Universal integration</span><b>Webhooks + REST</b><small>n8n / Make / Zapier optional</small></div><ArrowUpRight size={15} /></button>
    </section>

    <section className="panel inbound-event-lab">
      <div className="panel-head"><div><span className="panel-kicker">Integration test console</span><h3>Send an inbound hotel event</h3><p>Simulate what a PMS, payment processor, guest channel or reputation provider would send. The event enters the same policy-aware automation engine as internal hotel actions.</p></div></div>
      <div className="inbound-event-grid">
        <label><span>Normalized event</span><select value={testEvent} onChange={e => setTestEvent(e.target.value)}>
          <option value="guest.request_received">guest.request_received</option>
          <option value="payment.failed">payment.failed</option>
          <option value="review.negative">review.negative</option>
          <option value="prearrival.due">prearrival.due</option>
          <option value="occupancy.threshold">occupancy.threshold</option>
        </select></label>
        <div className="event-payload-preview"><span>Payload preview</span><code>{testEvent === "guest.request_received" ? '{ "request": "Extra pillows requested" }' : testEvent === "review.negative" ? '{ "guest": "Demo Guest", "score": 2 }' : testEvent === "occupancy.threshold" ? '{ "adjustment": 12 }' : '{ "demo": true }'}</code></div>
        <button className="primary-btn" onClick={sendInboundTest}><Play size={15} /> Send test event</button>
      </div>
      <div className="mini-note"><ShieldCheck size={15} /> Test events are local portfolio simulations; production inbound webhooks require signature verification, tenant resolution, idempotency and queue-backed execution.</div>
    </section>

    <div className="connections-layout">
      <aside className="panel provider-list">
        <div className="provider-head"><span className="panel-kicker">Integrations</span><h3>Connected services</h3><p>Select a provider to configure credentials and event delivery.</p></div>
        {Object.entries(providers).map(([id, p]) => <button key={id} className={selected === id ? "active" : ""} onClick={() => setSelected(id)}>
          <span className={"provider-logo " + p.tone}>{p.icon}</span>
          <div><b>{p.name}</b><small>{p.type}</small></div>
          <span className={"provider-state " + (connected[id] ? "connected" : "")}><i />{connected[id] ? "Demo connected" : "Setup"}</span>
        </button>)}
      </aside>

      <section className="panel credential-panel">
        <div className="credential-head">
          <div className={"provider-logo large " + provider.tone}>{provider.icon}</div>
          <div><span className="panel-kicker">{provider.type}</span><h2>{provider.name}</h2><p>{provider.note}</p></div>
          <StatusDot status={connected[selected] ? "Configured" : "Setup"} />
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
          <button className="primary-btn" onClick={save}><ShieldCheck size={16} /> Stage configuration</button>
        </div>
      </section>
    </div>

    <section className="panel table-panel webhook-console">
      <div className="panel-head"><div><span className="panel-kicker">Built-in integration gateway</span><h3>Signed webhook endpoints</h3><p>Outgoing events use event IDs, HMAC signatures, idempotency keys and retry/replay semantics in the production architecture.</p></div><button className="ghost-btn" onClick={() => setSelected("webhooks")}><PlugZap size={15} /> Configure webhooks</button></div>
      <div className="table-scroll"><table><thead><tr><th>Endpoint</th><th>Subscribed events</th><th>Deliveries</th><th>Last delivery</th><th>Success</th><th /></tr></thead><tbody>
        {webhookEndpoints.map(endpoint => <tr key={endpoint.id}><td><b>{endpoint.name}</b><small>{endpoint.url}</small></td><td>{endpoint.events.join(", ")}</td><td><b>{endpoint.deliveries}</b></td><td>{endpoint.last}</td><td><StatusDot status={endpoint.status} /><small>{endpoint.success}</small></td><td><button className="row-action" onClick={() => replayWebhook(endpoint)}>Replay test</button></td></tr>)}
      </tbody></table></div>
      <div className="mini-note"><Database size={15} /> Recent: {webhookDeliveries.slice(0,3).map(x => x.event+" → "+x.code+" ("+x.duration+")").join(" · ")}</div>
    </section>

    <section className="connection-health panel">
      <div className="panel-head"><div><span className="panel-kicker">Integration runtime design</span><h3>Credential & event delivery</h3></div><button className="ghost-btn" onClick={testAll} disabled={testingAll}><RefreshCw size={15} className={testingAll ? "spin" : ""} /> {testingAll ? "Running checks..." : "Run demo checks"}</button></div>
      <div className="connection-health-grid">
        <div><span className="health-icon green"><CheckCircle2 size={17} /></span><div><b>Webhook receiver</b><small>Signed-event validation flow</small></div><strong>Demo-ready</strong></div>
        <div><span className="health-icon blue"><KeyRound size={17} /></span><div><b>Token renewal</b><small>Scheduled refresh workflow</small></div><strong>Designed</strong></div>
        <div><span className="health-icon violet"><RefreshCw size={17} /></span><div><b>Conversion export</b><small>Attribution batch workflow</small></div><strong>Simulated</strong></div>
        <div><span className="health-icon amber"><Bell size={17} /></span><div><b>Failure policy</b><small>3 retries → operator alert</small></div><strong>{lastDemoCheck === "Not run" ? "Configured" : "Checked " + lastDemoCheck}</strong></div>
      </div>
    </section>
  </>;
}

export default App;
