import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  SlidersHorizontal,
  X,
  MoreHorizontal,
  LayoutDashboard,
  ClipboardList,
  Home,
  Landmark,
  Settings,
  Moon,
  LogOut,
  ShieldCheck,
  Search,
  CreditCard,
  FileText,
  Bell,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design notes
// Same token system as the Expenses redesign: zinc neutrals, hairline 1px
// borders, rounded-md surfaces, 13px UI text, tabular-nums for money,
// semantic color reserved for state (amber = overdue/warning, blue = primary,
// emerald = paid/current). Adds a persistent top navbar (missing in the
// original screenshot) and a right-hand detail drawer for the selected row,
// built from shadcn Sheet/Card conventions.
// ---------------------------------------------------------------------------

function Sidebar() {
  const navSections = [
    {
      label: "Operations",
      items: [
        { icon: ClipboardList, label: "Cashier reports" },
        {
          icon: Home,
          label: "In-house",
          active: true,
          children: [
            { label: "Records", active: true },
            { label: "Active" },
            { label: "Closed" },
            { label: "Blacklisted" },
          ],
        },
      ],
    },
    {
      label: "Finance",
      items: [{ icon: Landmark, label: "Accounts", badge: 5 }],
    },
  ];

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
                          key={child.label}
                          className={`w-full text-left rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                            child.active
                              ? "text-white font-medium"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {child.label}
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

function TopNavbar() {
  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-zinc-200 bg-white">
      <div className="flex items-center gap-2 text-[13px] min-w-0">
        <span className="font-semibold text-zinc-900 whitespace-nowrap">In-house records</span>
        <span className="text-zinc-300">/</span>
        <span className="text-zinc-500 truncate">Hi, Mark Joseph Verdadero</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-medium px-2 py-0.5 ml-1 whitespace-nowrap">
          <ShieldCheck size={12} /> Cashier
        </span>
        <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 ring-1 ring-inset ring-blue-200 whitespace-nowrap">
          GOA
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            placeholder="Search anything..."
            className="w-56 h-8 rounded-md border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-[12px] text-zinc-600 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:bg-white focus:border-zinc-300 transition-all"
          />
        </div>
        <button className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 transition-colors relative">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>
        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-[12px] font-semibold text-zinc-600">
          MV
        </div>
      </div>
    </header>
  );
}

const accounts = Array.from({ length: 13 }).map((_, i) => ({
  id: i,
  branch: "LAG",
  customer: `Customer${String(i + 1).padStart(2, "0")}, Sample`,
  code: `development-installment-account-${String(i + 1).padStart(2, "0")}`,
  status: "Overdue",
  totalPayable: "120,000.00",
  balance: "144,000.00",
}));

function StatusBadge({ status }) {
  const styles = {
    Overdue: "bg-amber-50 text-amber-700 ring-amber-200",
    Current: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Closed: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md ring-1 ring-inset text-[12px] font-medium px-2 py-0.5 ${
        styles[status] || styles.Closed
      }`}
    >
      {status}
    </span>
  );
}

function BranchTag() {
  return (
    <span className="inline-flex items-center rounded-md bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 text-[11px] font-semibold px-1.5 py-0.5">
      LAG
    </span>
  );
}

function Toolbar({ selectedCount }) {
  return (
    <div className="flex items-center justify-between px-6 py-3 gap-3">
      <div className="flex items-center gap-2">
        <button className="h-9 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
          <SlidersHorizontal size={13} />
          Filter
        </button>
        {selectedCount > 0 && (
          <span className="text-[12px] text-zinc-500 pl-1">
            {selectedCount} selected
          </span>
        )}
      </div>
      <button className="h-9 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">
        <Plus size={14} />
        Add Account
      </button>
    </div>
  );
}

function RecordsTable({ selectedRow, onSelectRow }) {
  const [checked, setChecked] = useState({});

  return (
    <div className="mx-6 rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60">
            <th className="w-10 px-4 py-2.5">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900" />
            </th>
            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Branch
            </th>
            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <button className="inline-flex items-center gap-1 hover:text-zinc-700">
                Account <ChevronUp size={11} />
              </button>
            </th>
            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Status
            </th>
            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 text-right">
              Total Payable
            </th>
            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 text-right">
              Balance
            </th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {accounts.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelectRow(row)}
              className={`border-b last:border-b-0 border-zinc-100 cursor-pointer transition-colors group ${
                selectedRow?.id === row.id ? "bg-blue-50/60" : "hover:bg-zinc-50/60"
              }`}
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!!checked[row.id]}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [row.id]: e.target.checked }))
                  }
                  className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
                />
              </td>
              <td className="px-3 py-3">
                <BranchTag />
              </td>
              <td className="px-3 py-3">
                <p className="text-[13px] font-medium text-zinc-900">{row.customer}</p>
                <p className="text-[12px] text-zinc-400">{row.code}</p>
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-3 text-[13px] text-zinc-700 text-right tabular-nums">
                ₱{row.totalPayable}
              </td>
              <td className="px-4 py-3 text-[13px] font-semibold text-zinc-900 text-right tabular-nums">
                ₱{row.balance}
              </td>
              <td className="px-2">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-600 transition-all"
                >
                  <MoreHorizontal size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 bg-zinc-50/60">
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          Rows
          <button className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12px] font-medium text-zinc-700">
            25 <ChevronDown size={12} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-zinc-500">
          <span>Showing 1–25 of 40 records</span>
          <div className="flex items-center gap-1">
            <button className="h-6 w-6 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-white transition-colors">
              <ChevronLeft size={13} />
            </button>
            <button className="h-6 w-6 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-white transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, valueClass = "" }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-zinc-500">{label}</span>
      <span className={`text-[13px] font-medium text-zinc-800 tabular-nums text-right ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function DetailPanel({ row, onClose }) {
  const [collapseStatus, setCollapseStatus] = useState(true);
  const [collapseBreakdown, setCollapseBreakdown] = useState(true);

  if (!row) {
    return (
      <aside className="hidden xl:flex w-[340px] shrink-0 flex-col h-full border-l border-zinc-200 bg-white items-center justify-center px-6 text-center">
        <div className="h-10 w-10 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-3">
          <FileText size={16} className="text-zinc-300" />
        </div>
        <p className="text-[13px] font-medium text-zinc-500">No account selected</p>
        <p className="text-[12px] text-zinc-400 mt-1">
          Select a row to see account details here.
        </p>
      </aside>
    );
  }

  return (
    <aside className="hidden xl:flex w-[340px] shrink-0 flex-col h-full border-l border-zinc-200 bg-white overflow-y-auto">
      <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-100 shrink-0">
        <h3 className="text-[14px] font-semibold text-zinc-900">Account Details</h3>
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-[15px] font-semibold text-zinc-900">{row.customer}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <BranchTag />
            <StatusBadge status={row.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 transition-colors shadow-sm">
            <CreditCard size={14} />
            Record Payment
          </button>
          <button className="h-9 px-3 inline-flex items-center justify-center rounded-md border border-zinc-200 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            View Ledger
          </button>
          <button className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            <MoreHorizontal size={15} />
          </button>
        </div>

        <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Outstanding Balance
          </p>
          <p className="text-[24px] font-bold text-zinc-900 tabular-nums mt-0.5">
            ₱{row.balance}
          </p>
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-zinc-200">
            <div>
              <p className="text-[11px] text-zinc-400">Next due</p>
              <p className="text-[13px] font-semibold text-zinc-800 mt-0.5">Aug 1, 2026</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">Installment</p>
              <p className="text-[13px] font-semibold text-zinc-800 mt-0.5 tabular-nums">₱12,000.00</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">Contract</p>
              <p className="text-[13px] font-semibold text-zinc-800 mt-0.5">Monthly · 12 mo.</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <button
            onClick={() => setCollapseStatus((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-zinc-50/60 transition-colors"
          >
            <div className="text-left">
              <p className="text-[13px] font-semibold text-zinc-900">Collection Status</p>
              <p className="text-[12px] text-zinc-400 mt-0.5">
                ₱{row.balance} balance · Aug 1, 2026 next due
              </p>
            </div>
            {collapseStatus ? (
              <ChevronDown size={15} className="text-zinc-400 shrink-0" />
            ) : (
              <ChevronUp size={15} className="text-zinc-400 shrink-0" />
            )}
          </button>
          {collapseStatus && (
            <div className="px-4 pb-3.5 pt-1 border-t border-zinc-100">
              <DetailRow label="Outstanding balance" value={`₱${row.balance}`} />
              <DetailRow label="Payment amount" value="₱12,000.00" />
              <DetailRow label="Frequency" value="Monthly" />
              <DetailRow label="No. of payments" value="12 months" />
              <DetailRow label="Next due" value="Aug 1, 2026" />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[13px] text-zinc-500">Loan status</span>
                <StatusBadge status={row.status} />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <button
            onClick={() => setCollapseBreakdown((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-zinc-50/60 transition-colors"
          >
            <div className="text-left">
              <p className="text-[13px] font-semibold text-zinc-900">Financial Breakdown</p>
              <p className="text-[12px] text-zinc-400 mt-0.5">
                ₱{row.totalPayable} total · ₱0.00 paid
              </p>
            </div>
            {collapseBreakdown ? (
              <ChevronDown size={15} className="text-zinc-400 shrink-0" />
            ) : (
              <ChevronUp size={15} className="text-zinc-400 shrink-0" />
            )}
          </button>
          {collapseBreakdown && (
            <div className="px-4 pb-3.5 pt-1 border-t border-zinc-100">
              <DetailRow label="Total payable" value={`₱${row.totalPayable}`} />
              <DetailRow label="Total paid" value="₱0.00" />
              <DetailRow label="Remaining balance" value={`₱${row.balance}`} valueClass="text-amber-700" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function InHouseRecordsRedesign() {
  const [selectedRow, setSelectedRow] = useState(accounts[0]);

  return (
    <div className="h-screen w-full flex bg-zinc-50 text-zinc-900 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar />
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto py-4">
            <Toolbar selectedCount={0} />
            <RecordsTable selectedRow={selectedRow} onSelectRow={setSelectedRow} />
          </main>
          <DetailPanel row={selectedRow} onClose={() => setSelectedRow(null)} />
        </div>
      </div>
    </div>
  );
}
