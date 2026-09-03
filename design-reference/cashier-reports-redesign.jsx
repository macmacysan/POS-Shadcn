import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  FileText,
  Download,
  AlertTriangle,
  LayoutDashboard,
  ClipboardList,
  Home,
  Archive,
  Ban,
  Landmark,
  Wallet,
  Settings,
  Moon,
  LogOut,
  ShieldCheck,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design notes
// shadcn/ui + reUI conventions: neutral zinc palette, 1px hairline borders,
// rounded-lg (8px) surfaces, 13px base UI text, subtle shadows only on
// popovers/menus (not cards), semantic color only for state (amber = warning,
// emerald = positive, blue = primary/link). Sidebar stays near-black to match
// the source; content area is a clean neutral-50 canvas.
// ---------------------------------------------------------------------------

const navSections = [
  {
    label: "Operations",
    items: [
      { icon: ClipboardList, label: "Cashier reports", active: true },
      {
        icon: Home,
        label: "In-house",
        children: ["Records", "Active", "Closed", "Blacklisted"],
      },
    ],
  },
  {
    label: "Finance",
    items: [{ icon: Landmark, label: "Accounts", badge: 5 }],
  },
];

function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 flex-col bg-zinc-950 text-zinc-300 h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
          <LayoutDashboard size={16} strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-white">Nueva Camsur</p>
          <p className="text-[13px] font-semibold text-white -mt-0.5">Home Furnishing</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <button className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
            <LayoutDashboard size={16} strokeWidth={2} />
            Dashboard
          </button>
        </div>

        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <div key={item.label}>
                  <button
                    className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                      item.active
                        ? "bg-white/10 text-white"
                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon size={16} strokeWidth={2} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="rounded bg-amber-500/15 text-amber-400 text-[11px] font-semibold px-1.5 py-0.5">
                        {item.badge}
                      </span>
                    )}
                  </button>
                  {item.children && (
                    <div className="ml-[27px] mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                      {item.children.map((child) => (
                        <button
                          key={child}
                          className="w-full text-left rounded-md px-2 py-1.5 text-[13px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          {child}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 px-3 py-4 space-y-0.5">
        {[
          { icon: Settings, label: "Settings" },
          { icon: Moon, label: "Dark mode" },
          { icon: LogOut, label: "Log out" },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <item.icon size={16} strokeWidth={2} />
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-zinc-200 bg-white">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-semibold text-zinc-900">Cashier reports</span>
        <span className="text-zinc-300">/</span>
        <span className="text-zinc-500">Hi, Mark Joseph Verdadero</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-medium px-2 py-0.5 ml-1">
          <ShieldCheck size={12} /> Cashier
        </span>
        <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 ring-1 ring-inset ring-blue-200">
          GOA
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-[12px] font-semibold text-zinc-600">
          MV
        </div>
      </div>
    </header>
  );
}

function SummaryCard() {
  return (
    <div className="w-[280px] shrink-0 flex flex-col h-full border-r border-zinc-200 bg-white">
      <div className="px-4 py-4 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <button className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
            <span className="h-3.5 w-3.5 rounded-sm bg-zinc-200" />
            Aug 21, 2026
          </div>
          <div className="flex items-center gap-1">
            <button className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
              <ChevronRight size={15} />
            </button>
            <button className="h-8 w-8 flex items-center justify-center rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors">
              <Plus size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <div className="grid grid-cols-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 pb-2 border-b border-zinc-100">
            <span>Type</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Amount</span>
          </div>
          {[
            { type: "SI-T", qty: "—", amount: "—" },
            { type: "DR", qty: "—", amount: "—" },
          ].map((row) => (
            <div
              key={row.type}
              className="grid grid-cols-3 text-[13px] py-2 border-b border-zinc-50 text-zinc-700"
            >
              <span className="font-medium">{row.type}</span>
              <span className="text-center text-zinc-400">{row.qty}</span>
              <span className="text-right text-zinc-400 tabular-nums">{row.amount}</span>
            </div>
          ))}
        </div>

        <dl className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <dt className="text-[13px] text-zinc-500">Finance Down</dt>
            <dd className="text-[13px] font-semibold text-zinc-900 tabular-nums">1,000.00</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[13px] font-semibold text-zinc-900">Total Receipts</dt>
            <dd className="text-[13px] font-semibold text-red-600 tabular-nums">-3,000.00</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[13px] text-zinc-500">Expenses</dt>
            <dd className="text-[13px] font-medium text-zinc-700 tabular-nums">123.00</dd>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
            <dt className="text-[13px] font-semibold text-zinc-900">Total Cash Out</dt>
            <dd className="text-[14px] font-bold text-zinc-900 tabular-nums">123.00</dd>
          </div>
        </dl>
      </div>

      <div className="mt-auto px-4 pb-4 pt-3 space-y-3 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-zinc-500">Expected Cash</span>
          <span className="text-[13px] font-semibold text-zinc-900 tabular-nums">-3,123.00</span>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-6 w-6 shrink-0 rounded-md bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle size={13} className="text-amber-600" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Cash Variance
                </span>
                <span className="text-[11px] font-semibold text-amber-700">Over by</span>
              </div>
              <p className="text-[19px] font-bold text-amber-900 tabular-nums mt-0.5">
                ₱3,123.00
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const tabs = [
  { label: "Expenses", count: 1 },
  { label: "Income", count: 0 },
  { label: "Payment", count: 0 },
  { label: "Activity History", count: 5 },
];

function Tabs() {
  const [active, setActive] = useState("Expenses");
  return (
    <div className="flex items-center gap-1run electron-vite dev border-zinc-200 px-1">
      {tabs.map((t) => (
        <button
          key={t.label}
          onClick={() => setActive(t.label)}
          className={`relative flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium transition-colors ${
            active === t.label
              ? "text-zinc-900"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          {t.label}
          {t.count > 0 && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                active === t.label
                  ? "bg-blue-50 text-blue-700"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {t.count}
            </span>
          )}
          {active === t.label && (
            <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-zinc-900 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

function Toolbar() {
  return (
    <div className="flex items-center justify-between px-6 py-3 gap-3">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            placeholder="Filter expenses..."
            className="w-full h-9 rounded-md border-zinc-200 bg-white pl-8 pr-3 text-[13px] text-zinc-700 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-shadow"
          />
        </div>
        <button className="h-9 shrink-0 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
          <SlidersHorizontal size={13} />
          Filter
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button className="h-9 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
          <FileText size={13} />
          Review Report
        </button>
        <button className="h-9 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
          <Download size={13} />
          Export
        </button>
        <button className="h-9 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 text-[13px] font-semibold text-white hover:bg-zinc-800 transition-colors shadow-sm">
          <Plus size={14} />
          Add Entry
        </button>
      </div>
    </div>
  );
}

const rows = [
  {
    type: "Company Expenses",
    typeColor: "amber",
    description: "asdf",
    category: "Other",
    receipt: "—",
    vat: "—",
    addedBy: "Mark Joseph Ve...",
    amount: "123.00",
  },
];

function ExpensesTable() {
  const [checked, setChecked] = useState({});
  return (
    <div className="mx-6 rounded-lg bg-white overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className=" border-zinc-200 bg-zinc-50/60">
            <th className="w-10 px-4 py-2.5">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
              />
            </th>
            {["Type", "Description", "Category", "Receipt No", "VAT", "Added by"].map(
              (h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {h}
                </th>
              )
            )}
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 text-right">
              Amount
            </th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b last:border-b-0 border-zinc-100 hover:bg-zinc-50/60 transition-colors group"
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [i]: e.target.checked }))
                  }
                  className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
                />
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center rounded-md bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 text-[12px] font-medium px-2 py-0.5">
                  {row.type}
                </span>
              </td>
              <td className="px-3 py-3 text-[13px] text-zinc-700">{row.description}</td>
              <td className="px-3 py-3 text-[13px] text-zinc-600">{row.category}</td>
              <td className="px-3 py-3 text-[13px] text-zinc-400">{row.receipt}</td>
              <td className="px-3 py-3 text-[13px] text-zinc-400">{row.vat}</td>
              <td className="px-3 py-3 text-[13px] text-zinc-600">{row.addedBy}</td>
              <td className="px-4 py-3 text-[13px] font-semibold text-zinc-900 text-right tabular-nums">
                ₱{row.amount}
              </td>
              <td className="px-2">
                <button className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-600 transition-all">
                  <MoreHorizontal size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* empty-state filler so a single row doesn't leave a dead void */}
      <div className="px-4 py-10 flex flex-col items-center justify-center text-center border-t border-zinc-100">
        <div className="h-9 w-9 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-2.5">
          <FileText size={15} className="text-zinc-300" />
        </div>
        <p className="text-[13px] font-medium text-zinc-500">
          That's every expense logged for Aug 21, 2026
        </p>
        <p className="text-[12px] text-zinc-400 mt-0.5">
          New entries you add will show up above this line.
        </p>
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 bg-zinc-50/60">
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          Rows
          <button className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12px] font-medium text-zinc-700">
            50 <ChevronDown size={12} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-zinc-500">
          <span>1–1 of 1 entries</span>
          <div className="flex items-center gap-1">
            <button
              disabled
              className="h-6 w-6 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-300"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              disabled
              className="h-6 w-6 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-300"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CashierReportsRedesign() {
  return (
    <div className="h-screen w-full flex bg-zinc-50 text-zinc-900 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 flex min-h-0">
          <SummaryCard />
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <div className="px-6">
              <Tabs />
            </div>
            <Toolbar />
            <ExpensesTable />
            <div className="h-8" />
          </main>
        </div>
      </div>
    </div>
  );
}
