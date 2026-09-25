import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925040000_ezstay_demo_lifecycle.sql", "utf8");

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
  for (const room of ["101","107","201","211"]) {
    assert.match(sql, new RegExp(`when room_number = '${room}' then 'Sky Suite'|when room_number in \\([^)]*'${room}'[^)]*\\) then 'Sky Suite'`));
  }
  for (const room of ["103","105","108","110"]) {
    assert.match(sql, new RegExp(`when room_number = '${room}' then 'City Queen'|when room_number in \\([^)]*'${room}'[^)]*\\) then 'City Queen'`));
  }
  for (const room of ["202","204","207","211"]) {
    const reservationBlock = sql.match(/insert into ezstay\.reservations[\s\S]*?;\n/)?.[0] || "";
    if (room === "211") assert.match(reservationBlock, /room_211_id, 'Sky Suite'/);
  }
});
