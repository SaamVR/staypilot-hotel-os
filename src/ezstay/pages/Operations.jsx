import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatCurrency, formatHotelClock } from "../ui/format.js";
import { scrollRecordIntoView } from "../ui/recordFocus.js";

const roomTone = room => room.maintenance !== "Clear" ? "danger" : room.housekeeping !== "Clean" ? "warning" : room.occupancy === "Vacant" ? "success" : "blue";
const reservationTone = status => status === "Checked out" ? "neutral" : status === "Checked in" ? "success" : status === "Cancelled" ? "danger" : "blue";

const roomFilters = {
  "All rooms": () => true,
  "Needs attention": room => room.maintenance !== "Clear" || room.housekeeping !== "Clean",
  "Reserved": room => room.occupancy === "Reserved",
  "Blocked": room => room.maintenance !== "Clear",
};

const taskViews = ["Open work","Completed","All work"];
const teamFilters = ["All teams","Housekeeping","Maintenance","Front desk"];

export default function Operations({ snapshot, onCompleteHousekeeping, busy, focusRecord }) {
  const timeZone = snapshot.hotel.timezone;
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [taskView, setTaskView] = useState("Open work");
  const [teamFilter, setTeamFilter] = useState("All teams");
  const filteredRooms = snapshot.rooms.filter(roomFilters[roomFilter] || roomFilters["All rooms"]);
  const tasksForView = snapshot.tasks.filter(task => taskView === "All work" || (taskView === "Completed" ? task.status === "Done" : task.status !== "Done"));
  const visibleTasks = tasksForView.filter(task => teamFilter === "All teams" || task.team === teamFilter);
  const taskHeading = taskView === "Completed" ? "Completed tasks" : taskView === "All work" ? "All tasks" : "Open tasks";

  useEffect(() => scrollRecordIntoView(focusRecord?.id), [focusRecord, snapshot]);

  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Current hotel state</span><h1>Operations</h1><p>Rooms, stays, service work, and inventory share the same operational state the automation engine reads and changes.</p></div>
    <section className="split-grid">
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Room state</span><h2>Availability & readiness</h2></div><small>{filteredRooms.length} of {snapshot.rooms.length} rooms</small></div>
        <div className="operator-filter-bar" aria-label="Room filters">{Object.keys(roomFilters).map(label => <button key={label} className={roomFilter === label ? "active" : ""} onClick={() => setRoomFilter(label)}>{label}<span>{snapshot.rooms.filter(roomFilters[label]).length}</span></button>)}</div>
        <div className="room-grid">{filteredRooms.map(room => <div className={`room-tile ${focusRecord?.id === room.id ? "record-focus" : ""}`} data-record-id={room.id} key={room.id}><div><b>{room.number}</b><small>{room.type}</small></div><StatusBadge tone={roomTone(room)}>{room.maintenance !== "Clear" ? "Blocked" : room.housekeeping !== "Clean" ? room.housekeeping : room.occupancy}</StatusBadge></div>)}</div>
      </article>
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Service board</span><h2>{taskHeading}</h2></div><small>{visibleTasks.length} shown</small></div>
        <div className="operator-filter-bar compact" aria-label="Task state filters">{taskViews.map(label => <button key={label} className={taskView === label ? "active" : ""} onClick={() => setTaskView(label)}>{label}<span>{label === "All work" ? snapshot.tasks.length : snapshot.tasks.filter(task => label === "Completed" ? task.status === "Done" : task.status !== "Done").length}</span></button>)}</div>
        <div className="operator-filter-bar compact" aria-label="Task team filters">{teamFilters.map(label => <button key={label} className={teamFilter === label ? "active" : ""} onClick={() => setTeamFilter(label)}>{label}<span>{label === "All teams" ? tasksForView.length : tasksForView.filter(task => task.team === label).length}</span></button>)}</div>
        <div className="list-table">{visibleTasks.map(task => <div className={`list-row ${focusRecord?.id === task.id ? "record-focus" : ""}`} data-record-id={task.id} key={task.id}><div><b>{task.place} · {task.title}</b><span>{task.team} · due {formatHotelClock(task.dueAt, timeZone)}</span></div><div className="row-actions"><StatusBadge tone={task.escalatedAt ? "danger" : task.status === "Done" ? "success" : "neutral"}>{task.escalatedAt && task.status !== "Done" ? "Escalated" : task.status}</StatusBadge>{task.team === "Housekeeping" && task.title === "Full turnover" && task.status !== "Done" && <button disabled={busy} onClick={() => onCompleteHousekeeping(task.id)}>Complete turnover</button>}</div></div>)}</div>
        {!visibleTasks.length && <div className="filtered-empty">No work matches the current state and team filters.</div>}
      </article>
    </section>
    <section className="split-grid operations-detail-grid">
      <article className="panel operations-detail-panel">
        <div className="panel-heading"><div><span className="eyebrow">Reservations</span><h2>Stays & arrivals</h2></div><small>{snapshot.reservations.length} records</small></div>
        <div className="list-table">{snapshot.reservations.map(reservation => {
          const room = snapshot.rooms.find(item => item.id === reservation.roomId);
          return <div className={`list-row record-row ${focusRecord?.id === reservation.id ? "record-focus" : ""}`} data-record-id={reservation.id} key={reservation.id}>
            <div><b>{reservation.guestName} · {room?.number ? `Room ${room.number}` : "Room unassigned"}</b><span>{reservation.externalRef} · {reservation.source} · {reservation.checkIn} → {reservation.checkOut}</span></div>
            <div className="row-actions record-row-meta"><StatusBadge tone={reservationTone(reservation.status)}>{reservation.status}</StatusBadge><small>{formatCurrency(reservation.paid, snapshot.hotel.currency)} / {formatCurrency(reservation.total, snapshot.hotel.currency)} paid</small></div>
          </div>;
        })}</div>
      </article>
      <article className="panel operations-detail-panel">
        <div className="panel-heading"><div><span className="eyebrow">Inventory</span><h2>Inventory & par levels</h2></div><small>{snapshot.inventory.filter(item => Number(item.stock) < Number(item.par)).length} below par</small></div>
        <div className="list-table">{snapshot.inventory.map(item => {
          const belowPar = Number(item.stock) < Number(item.par);
          return <div className={`list-row record-row ${focusRecord?.id === item.id ? "record-focus" : ""}`} data-record-id={item.id} key={item.id}>
            <div><b>{item.item}</b><span>{item.category} · {item.supplier}</span></div>
            <div className="row-actions record-row-meta"><StatusBadge tone={belowPar ? "warning" : "success"}>{belowPar ? "Below par" : "Healthy"}</StatusBadge><small>{item.stock} / {item.par} {item.unit}</small></div>
          </div>;
        })}</div>
      </article>
    </section>
    <section className="panel guest-request-panel">
      <div className="panel-heading"><div><span className="eyebrow">Guest requests</span><h2>Requests become operational work</h2></div><small>{snapshot.guestRequests.filter(row => row.status !== "Closed").length} open</small></div>
      <div className="list-table">{snapshot.guestRequests.map(request => {
        const room = snapshot.rooms.find(item => item.id === request.roomId);
        return <div className={`list-row ${focusRecord?.id === request.id ? "record-focus" : ""}`} data-record-id={request.id} key={request.id}><div><b>{request.request}</b><span>{request.category} · {room?.number ? `Room ${room.number}` : "Unassigned"} · received {formatHotelClock(request.createdAt, timeZone)}</span></div><StatusBadge tone="blue">{request.status}</StatusBadge></div>;
      })}</div>
    </section>
  </div>;
}
