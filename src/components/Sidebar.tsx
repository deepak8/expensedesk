"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Users,
  BarChart2,
  Settings,
  Leaf,
  LogOut,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from "@/components/ui/dialog";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/upload", label: "Upload Receipt", icon: Upload },
  { href: "/salary", label: "Salary", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface ProfileState {
  email: string;
  displayName: string;
  roleLabel: string;
}

const DEFAULT_PROFILE: ProfileState = {
  email: "",
  displayName: "Deepak K.",
  roleLabel: "Admin",
};

function fallbackName(email: string) {
  if (!email) return DEFAULT_PROFILE.displayName;
  return email.split("@")[0]?.replace(/[._-]+/g, " ") || DEFAULT_PROFILE.displayName;
}

function initialsFor(name: string, email: string) {
  const source = name.trim() || fallbackName(email);
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<ProfileState>(DEFAULT_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState(DEFAULT_PROFILE.displayName);
  const [roleLabel, setRoleLabel] = useState(DEFAULT_PROFILE.roleLabel);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const initials = useMemo(
    () => initialsFor(profile.displayName, profile.email),
    [profile.displayName, profile.email]
  );

  useEffect(() => {
    const hasSupabase =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!hasSupabase) return;

    let cancelled = false;
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const nextProfile = {
        email: user.email ?? "",
        displayName:
          typeof user.user_metadata?.display_name === "string" &&
          user.user_metadata.display_name.trim()
            ? user.user_metadata.display_name.trim()
            : fallbackName(user.email ?? ""),
        roleLabel:
          typeof user.user_metadata?.role_label === "string" &&
          user.user_metadata.role_label.trim()
            ? user.user_metadata.role_label.trim()
            : "Admin",
      };
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName);
      setRoleLabel(nextProfile.roleLabel);
    }

    loadProfile().catch(() => {
      // Keep fallback profile if Supabase cold-starts or session lookup fails.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function openProfile() {
    setDisplayName(profile.displayName);
    setRoleLabel(profile.roleLabel);
    setProfileError(null);
    setProfileOpen(true);
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);

    const nextDisplayName = displayName.trim() || fallbackName(profile.email);
    const nextRoleLabel = roleLabel.trim() || "User";

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: nextDisplayName,
          role_label: nextRoleLabel,
        },
      });

      if (error) throw error;

      setProfile({
        email: data.user?.email ?? profile.email,
        displayName: nextDisplayName,
        roleLabel: nextRoleLabel,
      });
      setProfileOpen(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-full bg-[rgb(24_24_24)] flex items-center justify-center">
          <Leaf className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-[14px] text-foreground tracking-normal">
          ExpenseDesk
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors",
                active
                  ? "bg-[rgb(248_248_248)] text-foreground"
                  : "text-muted-foreground hover:bg-[rgb(248_248_248)] hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 flex-shrink-0",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openProfile}
            title="Edit profile"
            className="min-w-0 flex flex-1 items-center gap-2.5 rounded-md p-1 text-left transition-colors hover:bg-[rgb(248_248_248)]"
          >
            <div className="w-7 h-7 rounded-full border border-border bg-[rgb(248_248_248)] flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                {profile.displayName}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{profile.roleLabel}</p>
            </div>
            <Pencil className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          </button>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[rgb(248_248_248)] hover:text-foreground transition-colors flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <form onSubmit={saveProfile}>
            <DialogBody className="space-y-4">
              {profileError && (
                <div className="rounded-md border border-[rgb(254_221_241)] bg-[rgb(254_221_241)] p-3 text-xs text-foreground">
                  {profileError}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Display Name
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={savingProfile}
                  className="ed-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Role / Title Label
                </label>
                <input
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  disabled={savingProfile}
                  placeholder="Admin, Finance, Owner, Manager"
                  className="ed-input"
                />
              </div>
              <div className="rounded-md border border-border bg-[rgb(248_248_248)] p-3">
                <p className="text-xs text-muted-foreground">Avatar Initials</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-xs font-semibold text-foreground">
                    {initialsFor(displayName, profile.email)}
                  </span>
                  <p className="text-xs text-muted-foreground">Derived from display name</p>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => setProfileOpen(false)}
                className="ed-quiet-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="ed-action-button"
              >
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
