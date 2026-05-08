"use client";

import Header from "@/components/Header";

function SettingRow({ label, description, control }: { label: string; description: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="ml-6 flex-shrink-0">{control}</div>
    </div>
  );
}

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  return (
    <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${defaultOn ? "bg-primary" : "bg-muted"}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${defaultOn ? "translate-x-4" : "translate-x-0.5"}`} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Settings" subtitle="Manage your workspace preferences" />

      <div className="p-6 flex-1 max-w-2xl space-y-6">
        {/* Business */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Business Details</p>
          <div className="space-y-3">
            {[["Business Name", "Deepak Ventures Pvt. Ltd."], ["GSTIN", "27AABCU9603R1ZN"], ["Financial Year Start", "April"], ["Currency", "INR (₹)"]].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 gap-4 items-center">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <input
                  defaultValue={value}
                  className="text-xs border border-border rounded-lg px-3 py-2 bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-border shadow-sm px-5">
          <p className="text-sm font-semibold text-foreground pt-4 mb-1">Notifications</p>
          <SettingRow label="Review reminders" description="Remind when expenses have been pending review for over 3 days" control={<Toggle defaultOn />} />
          <SettingRow label="Monthly summary email" description="Receive a monthly digest at the start of each month" control={<Toggle defaultOn />} />
          <SettingRow label="Salary payment reminders" description="Alert before salary due dates" control={<Toggle />} />
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-xl border border-border shadow-sm px-5">
          <p className="text-sm font-semibold text-foreground pt-4 mb-1">Preferences</p>
          <SettingRow label="Default expense category" description="Auto-assign category when uploading new receipts" control={
            <select className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none">
              <option>Software</option><option>Travel</option><option>Marketing</option>
            </select>
          } />
          <SettingRow label="Require receipt for all expenses" description="Flag expenses added without an attached receipt" control={<Toggle defaultOn />} />
        </div>

        <button className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );
}
