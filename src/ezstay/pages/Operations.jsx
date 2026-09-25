import StatusBadge from "../components/StatusBadge.jsx";

const roomTone = room => room.maintenance !== "Clear" ? "danger" : room.housekeeping !== "Clean" ? "warning" : room.occupancy === "Vacant" ? "success" : "blue";

export default function Operations({ snapshot, onCompleteHousekeeping, busy }) {
  return <div className="page-stack">
    <div className="page-header"><span className="eyebrow">Live hotel state</span><h1>Operations</h1><p>Rooms, service requests, and tasks share the same operational state the automation engine reads and changes.</p></div>
    <section className="split-grid">
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Room state</span><h2>Availability & readiness</h2></div><small>{snapshot.rooms.length} rooms</small></div>
        <div className="room-grid">{snapshot.rooms.map(room => <div className="room-tile" key={room.id}><div><b>{room.number}</b><small>{room.type}</small></div><StatusBadge tone={roomTone(room)}>{room.maintenance !== "Clear" ? "Blocked" : room.housekeeping !== "Clean" ? room.housekeeping : room.occupancy}</StatusBadge></div>)}</div>
      </article>
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Service board</span><h2>Open tasks</h2></div><small>{snapshot.tasks.filter(task => task.status !== "Done").length} open</small></div>
        <div className="list-table">{snapshot.tasks.map(task => <div className="list-row" key={task.id}><div><b>{task.place} · {task.title}</b><span>{task.team} · due {new Date(task.dueAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></div><div className="row-actions"><StatusBadge tone={task.escalatedAt ? "danger" : task.status === "Done" ? "success" : "neutral"}>{task.escalatedAt && task.status !== "Done" ? "Escalated" : task.status}</StatusBadge>{task.team === "Housekeeping" && task.title === "Full turnover" && task.status !== "Done" && <button disabled={busy} onClick={() => onCompleteHousekeeping(task.id)}>Complete turnover</button>}</div></div>)}</div>
      </article>
    </section>
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">Guest requests</span><h2>Requests become operational work</h2></div></div>
      <div className="list-table">{snapshot.guestRequests.map(request => <div className="list-row" key={request.id}><div><b>{request.request}</b><span>{request.category} · {snapshot.rooms.find(room => room.id === request.roomId)?.number ? `Room ${snapshot.rooms.find(room => room.id === request.roomId).number}` : "Unassigned"}</span></div><StatusBadge tone="blue">{request.status}</StatusBadge></div>)}</div>
    </section>
  </div>;
}
