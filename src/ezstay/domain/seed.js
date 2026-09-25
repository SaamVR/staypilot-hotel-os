import {
  BACKEND_CONTRACT_VERSION,
  DEFAULT_DEMO_NOW,
  SEED_VERSION,
} from "./constants.js";

const HOTEL_ID = "hotel_northstar";

function buildRooms() {
  const overrides = {
    "103": { type:"City Queen", occupancy:"Vacant", housekeeping:"Cleaning", maintenance:"Clear" },
    "105": { type:"City Queen", occupancy:"Reserved", housekeeping:"Clean", maintenance:"Clear" },
    "108": { type:"City Queen", occupancy:"Occupied", housekeeping:"Clean", maintenance:"Clear" },
    "110": { type:"City Queen", occupancy:"Reserved", housekeeping:"Clean", maintenance:"Clear" },
    "202": { type:"Deluxe King", occupancy:"Reserved", housekeeping:"Clean", maintenance:"Clear" },
    "204": { type:"Deluxe King", occupancy:"Reserved", housekeeping:"Clean", maintenance:"Clear" },
    "207": { type:"Deluxe King", occupancy:"Vacant", housekeeping:"Clean", maintenance:"Out of order" },
    "211": { type:"Sky Suite", occupancy:"Reserved", housekeeping:"Clean", maintenance:"Clear" },
  };

  return Array.from({ length:24 }, (_, index) => {
    const floor = index < 12 ? 1 : 2;
    const number = String(floor * 100 + (index % 12) + 1);
    const fallbackType = index % 6 === 0 ? "Sky Suite" : index % 2 === 0 ? "Deluxe King" : "City Queen";
    return {
      id:`room_${number}`,
      hotelId:HOTEL_ID,
      number,
      type:fallbackType,
      occupancy:"Vacant",
      housekeeping:"Clean",
      maintenance:"Clear",
      ...(overrides[number] || {}),
    };
  });
}

const base = {
  meta:{
    schemaVersion:1,
    seedVersion:SEED_VERSION,
    backendContractVersion:BACKEND_CONTRACT_VERSION,
    demoNow:DEFAULT_DEMO_NOW,
    resetGeneration:0,
  },
  hotel:{
    id:HOTEL_ID,
    name:"Northstar Grand",
    timezone:"Asia/Dhaka",
    currency:"USD",
    automationPaused:false,
  },
  rooms:buildRooms(),
  reservations:[
    { id:"res_1048", hotelId:HOTEL_ID, externalRef:"EZ-1048", guestName:"Olivia Martin", roomId:"room_204", roomType:"Deluxe King", source:"Booking.com", checkIn:"2026-09-25", checkOut:"2026-09-27", guests:2, total:684, paid:684, status:"Confirmed" },
    { id:"res_1047", hotelId:HOTEL_ID, externalRef:"EZ-1047", guestName:"Noah Williams", roomId:"room_108", roomType:"City Queen", source:"Airbnb", checkIn:"2026-09-24", checkOut:"2026-09-25", guests:2, total:418, paid:418, status:"Checked in" },
    { id:"res_1046", hotelId:HOTEL_ID, externalRef:"EZ-1046", guestName:"Ava Garcia", roomId:"room_211", roomType:"Sky Suite", source:"Direct", checkIn:"2026-09-25", checkOut:"2026-09-28", guests:3, total:1180, paid:1180, status:"Confirmed" },
    { id:"res_1045", hotelId:HOTEL_ID, externalRef:"EZ-1045", guestName:"Liam Chen", roomId:"room_105", roomType:"City Queen", source:"Expedia", checkIn:"2026-09-24", checkOut:"2026-09-27", guests:2, total:527, paid:260, status:"Confirmed" },
    { id:"res_1044", hotelId:HOTEL_ID, externalRef:"EZ-1044", guestName:"Sophia Brown", roomId:"room_202", roomType:"Deluxe King", source:"Agoda", checkIn:"2026-09-24", checkOut:"2026-09-26", guests:2, total:456, paid:456, status:"Confirmed" },
    { id:"res_1043", hotelId:HOTEL_ID, externalRef:"EZ-1043", guestName:"Ethan Lee", roomId:"room_110", roomType:"City Queen", source:"Direct", checkIn:"2026-09-25", checkOut:"2026-09-29", guests:1, total:612, paid:122, status:"Confirmed" },
  ],
  guestRequests:[
    { id:"req_seed_108", hotelId:HOTEL_ID, reservationId:"res_1047", roomId:"room_108", request:"Extra towels requested", category:"Housekeeping", urgency:"Normal", status:"Open", createdAt:"2026-09-25T10:08:00+06:00" },
  ],
  tasks:[
    { id:"task_103_turnover", hotelId:HOTEL_ID, roomId:"room_103", reservationId:null, place:"Room 103", title:"Full turnover", team:"Housekeeping", dueAt:"2026-09-25T10:45:00+06:00", status:"In progress", automated:true, sourceEventId:"evt_seed_turnover_103" },
    { id:"task_207_hvac", hotelId:HOTEL_ID, roomId:"room_207", reservationId:null, place:"Room 207", title:"HVAC inspection", team:"Maintenance", dueAt:"2026-09-25T11:00:00+06:00", status:"Assigned", automated:false, sourceEventId:null },
    { id:"task_108_towels", hotelId:HOTEL_ID, roomId:"room_108", reservationId:"res_1047", place:"Room 108", title:"Extra towels requested", team:"Housekeeping", dueAt:"2026-09-25T10:35:00+06:00", status:"New", automated:true, sourceEventId:"evt_seed_request_108" },
    { id:"task_vip_lobby", hotelId:HOTEL_ID, roomId:null, reservationId:"res_1046", place:"Lobby", title:"VIP welcome setup", team:"Front desk", dueAt:"2026-09-25T15:30:00+06:00", status:"Queued", automated:false, sourceEventId:null },
  ],
  inventory:[
    { id:"inv_towels", hotelId:HOTEL_ID, item:"Bath towels", category:"Linen", stock:86, par:72, unit:"pcs", unitCost:8.5, supplier:"Coastal Textile" },
    { id:"inv_queen_sheets", hotelId:HOTEL_ID, item:"Queen bed sheets", category:"Linen", stock:34, par:42, unit:"sets", unitCost:18, supplier:"Coastal Textile" },
    { id:"inv_shampoo", hotelId:HOTEL_ID, item:"Shampoo 40ml", category:"Amenities", stock:212, par:160, unit:"bottles", unitCost:0.65, supplier:"GuestCare" },
    { id:"inv_dental", hotelId:HOTEL_ID, item:"Dental kits", category:"Amenities", stock:78, par:96, unit:"kits", unitCost:0.9, supplier:"GuestCare" },
    { id:"inv_detergent", hotelId:HOTEL_ID, item:"Laundry detergent", category:"Housekeeping", stock:18, par:20, unit:"litres", unitCost:4.4, supplier:"CleanPro" },
    { id:"inv_water", hotelId:HOTEL_ID, item:"Minibar water", category:"F&B", stock:146, par:120, unit:"bottles", unitCost:0.35, supplier:"Fresh Supply" },
  ],
  approvals:[
    { id:"apr_104", hotelId:HOTEL_ID, type:"Maintenance", title:"Room 207 HVAC invoice", detail:"CoolTech · diagnostic + service", amount:165, status:"Pending", requestedBy:"Sam Rahman", createdAt:"2026-09-25T10:19:00+06:00" },
    { id:"apr_103", hotelId:HOTEL_ID, type:"Purchase order", title:"Queen bed sheet restock", detail:"20 sets · Coastal Textile", amount:360, inventoryItemId:"inv_queen_sheets", quantity:20, status:"Pending", requestedBy:"Sam Rahman", createdAt:"2026-09-25T09:56:00+06:00" },
  ],
  purchaseRequests:[],
  automationRules:[
    ["reservation-intake","Reservation intake","reservation.created","Auto"],
    ["checkout-turnover","Checkout turnover","guest.checked_out","Auto"],
    ["prearrival-message","Pre-arrival message","prearrival.due","Auto"],
    ["occupancy-rate-guard","Occupancy rate guard","occupancy.threshold","Policy"],
    ["failed-payment-recovery","Failed payment recovery","payment.failed","Auto"],
    ["low-stock-replenishment","Low-stock replenishment","inventory.low_stock","Policy"],
    ["cancellation-recovery","Cancellation recovery","reservation.cancelled","Auto"],
    ["room-ready-release","Room-ready release","housekeeping.completed","Auto"],
    ["room-conflict-guard","Room conflict guard","room.maintenance_blocked","Approval"],
    ["guest-request-router","Guest request router","guest.request_received","Auto"],
    ["approval-executor","Approval executor","approval.approved","Auto"],
    ["review-recovery","Review recovery","review.negative","Approval"],
  ].map(([key,name,eventType,autonomy], index) => ({
    id:`rule_${String(index + 1).padStart(2,"0")}`,
    hotelId:HOTEL_ID,
    key,
    name,
    eventType,
    autonomy,
    status:"Active",
  })),
  inboundEvents:[],
  automationRuns:[
    {
      id:"RUN-2818",
      hotelId:HOTEL_ID,
      eventId:"evt_seed_res_1048",
      ruleKey:"reservation-intake",
      result:"Success",
      summary:"Reservation received and inventory reconciled.",
      input:{ reservationId:"res_1048" },
      decision:{ autonomy:"Auto", reason:"Routine reservation intake is inside policy." },
      changes:[{ entityType:"reservation", entityId:"res_1048", action:"confirmed" }],
      delivery:[{ id:"DLV-402", status:"Delivered" }],
      audit:[{ at:"2026-09-25T10:28:14+06:00", effectiveAt:"2026-09-25T10:28:14+06:00", message:"Reservation intake completed." }],
      linkedRecords:[{ type:"reservation", id:"res_1048", label:"EZ-1048 · Olivia Martin" }],
    },
  ],
  deliveries:[
    { id:"DLV-402", hotelId:HOTEL_ID, runId:"RUN-2818", channel:"Demo guest message", status:"Delivered", attempts:1, lastError:null, createdAt:"2026-09-25T10:28:15+06:00" },
    { id:"DLV-400", hotelId:HOTEL_ID, runId:"RUN-2815", channel:"Demo operations webhook", status:"Dead-letter", attempts:5, lastError:"503 upstream unavailable", createdAt:"2026-09-25T09:49:00+06:00" },
  ],
  auditEvents:[
    { id:"audit_seed_1", hotelId:HOTEL_ID, actorKind:"automation", category:"Automation", action:"Reservation intake completed", createdAt:"2026-09-25T10:28:14+06:00" },
  ],
  commandLedger:{},
};

export function createNorthstarSeed() {
  return structuredClone(base);
}

export function northstarHotelId() {
  return HOTEL_ID;
}
