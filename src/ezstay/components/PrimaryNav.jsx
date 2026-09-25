import { Activity, Blocks, ClipboardCheck, LayoutDashboard, PlugZap, Workflow } from "lucide-react";
import { PRIMARY_NAV } from "../domain/navigation.js";

const icons = {
  command:LayoutDashboard,
  operations:Blocks,
  automations:Workflow,
  approvals:ClipboardCheck,
  activity:Activity,
  integrations:PlugZap,
};

export default function PrimaryNav({ active, onChange }) {
  return <nav className="primary-nav" aria-label="EZStay sections">
    {PRIMARY_NAV.map(item => {
      const Icon = icons[item.key];
      return <button key={item.key} className={active === item.key ? "active" : ""} onClick={() => onChange(item.key)}>
        <Icon size={18}/><span>{item.label}</span>
      </button>;
    })}
  </nav>;
}
