"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import type {
  AdminEvent,
  AdminOrder,
  AdminProfile,
  Announcement,
  Buyer,
  DiscountCode,
  DiscountCut,
  EventDraft,
  InflowDay,
  Lead,
  StaffAccount,
  UserRole,
} from "@/lib/admin-mock";

type AdminState = {
  profile: AdminProfile;
  events: AdminEvent[];
  discounts: DiscountCode[];
  announcements: Announcement[];
  buyers: Buyer[];
  leads: Lead[];
  inflowDays: InflowDay[];
  orders: AdminOrder[];
  staff: StaffAccount[];
};

type DiscountDraft = {
  code: string;
  eventId: string;
  cut: DiscountCut;
  percent: number;
  amount: number;
  usageLimit: number;
};

type AdminStore = AdminState & {
  role: UserRole;
  revision: number;
  createEvent: (draft: EventDraft) => Promise<string | null>;
  updateEvent: (id: string, draft: EventDraft) => Promise<string | null>;
  provisionTickets: (eventId: string, tierId: string, count: number) => Promise<string | null>;
  deleteTickets: (
    eventId: string,
    input: { code?: string; allUnsold?: boolean },
  ) => Promise<{ error: string | null; deleted: number }>;
  addDiscount: (draft: DiscountDraft) => Promise<string | null>;
  redeemDiscount: (id: string) => Promise<string | null>;
  addAnnouncement: (title: string, body: string) => Promise<void>;
  updateProfile: (name: string) => Promise<string | null>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<string | null>;
  createStaff: (input: { name: string; email: string; password: string; role: UserRole }) => Promise<string | null>;
  resetStaff: (id: string, password: string) => Promise<string | null>;
  disableStaff: (id: string) => Promise<string | null>;
  confirmOrder: (id: string) => Promise<string | null>;
  resendOrder: (id: string) => Promise<string | null>;
};

type AdminStoreContextValue = {
  status: "loading" | "ready" | "error";
  error: string;
  store: AdminStore | null;
};

const AdminStoreContext = createContext<AdminStoreContextValue | null>(null);

async function message(task: () => Promise<void>, refresh: () => Promise<void>) {
  try {
    await task();
    await refresh();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }
}

export function AdminStoreProvider({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const [state, setState] = useState<AdminState | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const next = await api<AdminState>("/api/admin/state");
    setState(next);
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancel = false;
    api<AdminState>("/api/admin/state")
      .then((next) => {
        if (cancel) return;
        setState(next);
        setRevision((current) => current + 1);
      })
      .catch((loadError: unknown) => {
        if (cancel) return;
        setError(loadError instanceof Error ? loadError.message : "The admin data did not load.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const store = useMemo<AdminStore | null>(() => {
    if (!state) return null;
    return {
      ...state,
      role,
      revision,
      createEvent: (draft) =>
        message(() => api("/api/admin/events", { method: "POST", body: JSON.stringify(draft) }), refresh),
      updateEvent: (id, draft) =>
        message(
          () => api(`/api/admin/events/${id}`, { method: "POST", body: JSON.stringify(draft) }),
          refresh,
        ),
      provisionTickets: (eventId, tierId, count) =>
        message(
          () =>
            api("/api/admin/tickets/provision", {
              method: "POST",
              body: JSON.stringify({ eventId, tierId, count }),
            }),
          refresh,
        ),
      deleteTickets: async (eventId, input) => {
        try {
          const result = await api<{ deleted: number }>("/api/admin/tickets/delete", {
            method: "POST",
            body: JSON.stringify({ eventId, ...input }),
          });
          await refresh();
          return { error: null, deleted: result.deleted };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : "Something went wrong.",
            deleted: 0,
          };
        }
      },
      addDiscount: (draft) =>
        message(() => api("/api/admin/discounts", { method: "POST", body: JSON.stringify(draft) }), refresh),
      redeemDiscount: (id) =>
        message(() => api(`/api/admin/discounts/${id}/redeem`, { method: "POST" }), refresh),
      addAnnouncement: async (title, body) => {
        await api("/api/admin/announcements", {
          method: "POST",
          body: JSON.stringify({ title, body }),
        });
        await refresh();
      },
      updateProfile: (name) =>
        message(() => api("/api/admin/profile", { method: "POST", body: JSON.stringify({ name }) }), refresh),
      changePassword: (currentPassword, nextPassword) =>
        message(
          () =>
            api("/api/admin/profile/password", {
              method: "POST",
              body: JSON.stringify({ currentPassword, nextPassword }),
            }),
          refresh,
        ),
      createStaff: (input) =>
        message(() => api("/api/admin/staff", { method: "POST", body: JSON.stringify(input) }), refresh),
      resetStaff: (id, password) =>
        message(
          () =>
            api(`/api/admin/staff/${id}`, {
              method: "POST",
              body: JSON.stringify({ action: "reset", password }),
            }),
          refresh,
        ),
      disableStaff: (id) =>
        message(
          () =>
            api(`/api/admin/staff/${id}`, {
              method: "POST",
              body: JSON.stringify({ action: "disable" }),
            }),
          refresh,
        ),
      confirmOrder: async (id) => {
        try {
          const result = await api<{ emailError: string | null }>(`/api/admin/orders/${id}/confirm`, {
            method: "POST",
          });
          await refresh().catch(() => undefined);
          return result.emailError;
        } catch (error) {
          return error instanceof Error ? error.message : "Something went wrong.";
        }
      },
      resendOrder: async (id) => {
        try {
          await api(`/api/admin/orders/${id}/resend`, { method: "POST" });
          await refresh();
          return null;
        } catch (error) {
          await refresh().catch(() => undefined);
          return error instanceof Error ? error.message : "Something went wrong.";
        }
      },
    };
  }, [refresh, revision, role, state]);

  const status = error ? "error" : store ? "ready" : "loading";

  return (
    <AdminStoreContext.Provider value={{ status, error, store }}>{children}</AdminStoreContext.Provider>
  );
}

export function useAdminStatus() {
  const value = useContext(AdminStoreContext);
  if (!value) throw new Error("Admin store is missing.");
  return { status: value.status, error: value.error };
}

export function useAdminStore() {
  const value = useContext(AdminStoreContext);
  if (!value?.store) throw new Error("Admin store is missing.");
  return value.store;
}
