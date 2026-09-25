import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925040000_ezstay_demo_lifecycle.sql", "utf8");
const snapshotSql = readFileSync("supabase/migrations/20260925060000_ezstay_runtime_role.sql", "utf8");

test("durable Northstar fixture carries all six presentation reservations", () => {
  for (const ref of ["EZ-1048","EZ-1047","EZ-1046","EZ-1045","EZ-1044","EZ-1043"]) {
    assert.match(sql, new RegExp(ref));
  }
  for (const guest of ["Olivia Martin","Noah Williams","Ava Garcia","Liam Chen","Sophia Brown","Ethan Lee"]) {
    assert.match(sql, new RegExp(guest));
  }
});

test("durable Northstar fixture carries the four presentation tasks", () => {
  for (const task of ["Full turnover","HVAC inspection","Extra towels requested","VIP welcome setup"]) {
    assert.match(sql, new RegExp(task));
  }
});

test("durable Northstar fixture carries both pending human gates", () => {
  assert.match(sql, /Room 207 HVAC invoice/);
  assert.match(sql, /Queen bed sheet restock/);
});

test("durable room types match the visible local-preview fixture", () => {
  const typeCase = sql.match(
    /case\s+when room_number in \(([^)]+)\) then 'Sky Suite'\s+when room_number in \(([^)]+)\) then 'Deluxe King'\s+else 'City Queen'\s+end/
  );
  assert.ok(typeCase, "room type CASE expression");
  const parseRooms = value => [...value.matchAll(/'(\d{3})'/g)].map(match => match[1]).sort();
  assert.deepEqual(parseRooms(typeCase[1]), ["101","107","201","211"]);
  assert.deepEqual(parseRooms(typeCase[2]), ["109","111","202","203","204","205","207","209"]);
  const reservationBlock = sql.match(/insert into ezstay\.reservations[\s\S]*?;\n/)?.[0] || "";
  assert.match(reservationBlock, /room_211_id, 'Sky Suite'/);
  assert.match(reservationBlock, /room_110_id, 'City Queen'/);
});

test("backend snapshot preserves non-room task place metadata", () => {
  assert.match(snapshotSql, /coalesce\(x\.metadata\s*->>\s*'place',\s*'Property'\)/);
});
