import { useState } from "react";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatHotelClock } from "../ui/format.js";

const roomTone = room => room.maintenance !== "Clear" ? "danger" : room.housekeeping !== "Clean" ? "warning" : room.occupancy === "Vacant" ? "success" : "blue";

const roomFilters = {
  "All rooms": () => true,
  "Needs attention": room => room.maintenance !== "Clear" || room.housekeeping !== "Clean",
  "Reserved": room => room.occupancy === "Reserved",
  "Blocked": room => room.maintenance !== "Clear",
};

const teamFilters = ["All teams","Housekeeping","Maintenance","Front desk"];

export default function Operations({ snapshot, onCompleteHousekeeping, busy }) {
  const timeZone = snapshot.hotel.timezone;
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [teamFilter, setTeamFilter] = useState("All teams");
  const filteredRooms = snapshot.rooms.filter(roomFilters[roomFilter] || roomFilters["All rooms"]);
  const filteredTasks = snapshot.tasks.filter(task => teamFilter === "All teams" || task.team === teamFilter);

  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Live hotel state</span><h1>Operations</h1><p>Rooms, service requests, and tasks share the same operational state the automation engine reads and changes.</p></div>
    <section className="split-grid">
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Room state</span><h2>Availability & readiness</h2></div><small>{filteredRooms.length} of {snapshot.rooms.length} rooms</small></div>
        <div className="operator-filter-bar" aria-label="Room filters">{Object.keys(roomFilters).map(label => <button key={label} className={roomFilter === label ? "active" : ""} onClick={() => setRoomFilter(label)}>{label}<span>{snapshot.rooms.filter(roomFilters[label]).length}</span></button>)}</div>
        <div className="room-grid">{filteredRooms.map(room => <div className="room-tile" key={room.id}><div><b>{room.number}</b><small>{room.type}</small></div><StatusBadge tone={roomTone(room)}>{room.maintenance !== "Clear" ? "Blocked" : room.housekeeping !== "Clean" ? room.housekeeping : room.occupancy}</StatusBadge></div>)}</div>
      </article>
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Service board</span><h2>Open tasks</h2></div><small>{filteredTasks.filter(task => task.status !== "Done").length} shown open</small></div>
        <div className="operator-filter-bar compact" aria-label="Task team filters">{teamFilters.map(label => <button key={label} className={teamFilter === label ? "active" : ""} onClick={() => setTeamFilter(label)}>{label}<span>{label === "All teams" ? snapshot.tasks.length : snapshot.tasks.filter(task => task.team === label).length}</span></button>)}</div>
        <div className="list-table">{filteredTasks.map(task => <div className="list-row" key={task.id}><div><b>{task.place} · {task.title}</b><span>{task.team} · due {formatHotelClock(task.dueAt, timeZone)}</span></div><div className="row-actions"><StatusBadge tone={task.escalatedAt ? "danger" : task.status === "Done" ? "success" : "neutral"}>{task.escalatedAt && task.status !== "Done" ? "Escalated" : task.status}</StatusBadge>{task.team === "Housekeeping" && task.title === "Full turnover" && task.status !== "Done" && <button disabled={busy} onClick={() => onCompleteHousekeeping(task.id)}>Complete turnover</button>}</div></div>)}</div>
        {!filteredTasks.length && <div className="filtered-empty">No work is assigned to this team in the current shift.</div>}
      </article>
    </section>
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">Guest requests</span><h2>Requests become operational work</h2></div><small>{snapshot.guestRequests.filter(row => row.status !== "Closed").length} open</small></div>
      <div className="list-table">{snapshot.guestRequests.map(request => {
        const room = snapshot.rooms.find(item => item.id === request.roomId);
        return <div className="list-row" key={request.id}><div><b>{request.request}</b><span>{request.category} · {room?.number ? `Room ${room.number}` : "Unassigned"} · received {formatHotelClock(request.createdAt, timeZone)}</span></div><StatusBadge tone="blue">{request.status}</StatusBadge></div>;
      })}</div>
    </section>
  </div>;
}
