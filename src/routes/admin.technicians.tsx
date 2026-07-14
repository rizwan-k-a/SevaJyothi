import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/config/supabase";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowLeft,
  FileCheck,
  User,
  Mail,
  MapPin,
  Phone,
  Clock,
  Loader2,
  Ban
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

export type ApplicationRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  region: string | null;
  technical_skill: string | null;
  vehicle_available: boolean;
  status: "pending" | "approved" | "rejected";
  document_status: "pending" | "verified" | "failed";
  created_at: string;
};

export type TechnicianRow = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  village: string | null;
  last_sign_in_at: string | null;
  open_jobs: number;
  resolved_jobs: number;
  banned_until: string | null;
  created_at?: string; 
};

export type CitizenRow = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  village: string | null;
  created_at: string;
};

export const Route = createFileRoute("/admin/technicians")({
  head: () => ({ meta: [{ title: "User Administration · SevaJyothi" }] }),
  component: UserManagementPage,
});

type Tab = "applications" | "technicians" | "citizens";

function Avatar({ name, email, className = "" }: { name?: string | null; email: string; className?: string }) {
  const initial = (name || email || "?").charAt(0).toUpperCase();
  return (
    <div className={`flex items-center justify-center bg-accent/10 text-accent font-semibold rounded-full shrink-0 ${className}`}>
      {initial}
    </div>
  );
}

function UserManagementPage() {
  const navigate = useNavigate();
  const { roles, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>("applications");

  const [techs, setTechs] = useState<TechnicianRow[]>([]);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [cits, setCits] = useState<CitizenRow[]>([]);

  const [viewApp, setViewApp] = useState<ApplicationRow | null>(null);
  const [viewTech, setViewTech] = useState<TechnicianRow | null>(null);
  const [viewCit, setViewCit] = useState<CitizenRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // Active Techs Filters & Pagination
  const [techSearch, setTechSearch] = useState("");
  const [techStatus, setTechStatus] = useState<"all" | "active" | "suspended">("all");
  const [techSort, setTechSort] = useState<"name" | "date">("name");
  const [techSortDir, setTechSortDir] = useState<"asc" | "desc">("asc");
  const [techPage, setTechPage] = useState(1);
  const [citPage, setCitPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const isAuthority = roles.includes("authority");

  const listApps = async () => {
    const { data, error } = await supabase.functions.invoke("admin", {
      body: { action: "listApplications" },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as ApplicationRow[];
  };

  const listTechs = async () => {
    const { data, error } = await supabase.functions.invoke("admin", {
      body: { action: "listTechnicians" },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as TechnicianRow[];
  };

  const listCits = async () => {
    const { data, error } = await supabase.functions.invoke("admin", {
      body: { action: "listCitizens" },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as CitizenRow[];
  };

  const approve = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("admin", {
      body: { action: "approveTechnician", id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  };

  const reject = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("admin", {
      body: { action: "rejectTechnician", id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  };

  const setBan = async (user_id: string, disable: boolean) => {
    const { data, error } = await supabase.functions.invoke("admin", {
      body: { action: "setTechnicianBan", id: user_id, banned: disable },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  };

  const del = async (user_id: string, role: 'technician' | 'citizen' = 'technician') => {
    const action = role === 'technician' ? 'deleteTechnician' : 'deleteUser';
    const { data, error } = await supabase.functions.invoke("admin", {
      body: { action, id: user_id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  };

  async function refresh() {
    setErr(null);
    try {
      const [t, a, c] = await Promise.all([listTechs(), listApps(), listCits()]);
      setTechs(t);
      setApps(a);
      setCits(c);
    } catch (e: any) {
      setErr(e.message || "Failed to load data from Supabase.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthority) {
      navigate({ to: "/" });
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthority]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await approve(id);
      
      // Optimistically update
      const app = apps.find(a => a.id === id);
      setApps(prev => prev.filter(a => a.id !== id));
      if (app) {
        setTechs(prev => [{
          id: id,
          email: app.email,
          display_name: app.full_name,
          phone: app.phone,
          village: app.region,
          last_sign_in_at: null,
          open_jobs: 0,
          resolved_jobs: 0,
          banned_until: null,
          created_at: new Date().toISOString()
        }, ...prev]);
      }
      
      toast.success("Technician approved successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to approve.");
      await refresh(); // revert on failure
    } finally {
      setActionId(null);
    }
  };

  const handleReject = (id: string) => {
    setConfirmAction({
      title: "Reject Application",
      message: "Are you sure you want to reject this application?",
      onConfirm: async () => {
        setActionId(id);
        try {
          await reject(id);
          setApps(prev => prev.filter(a => a.id !== id));
          toast.success("Application rejected");
        } catch (e: any) {
          toast.error(e.message || "Failed to reject.");
          await refresh(); // revert on failure
        } finally {
          setActionId(null);
        }
      }
    });
  };

  const handleToggleBan = (id: string, currentBan: string | null) => {
    setConfirmAction({
      title: currentBan ? "Restore Technician" : "Suspend Technician",
      message: currentBan ? "Are you sure you want to restore access to this technician?" : "Are you sure you want to suspend this technician?",
      onConfirm: async () => {
        setActionId(id);
        try {
          const isBanning = !currentBan;
          await setBan(id, isBanning);
          setTechs(prev => prev.map(t => t.id === id ? { ...t, banned_until: isBanning ? new Date().toISOString() : null } : t));
          toast.success(currentBan ? "Technician restored" : "Technician suspended");
        } catch (e: any) {
          toast.error(e.message || "Failed to update ban status.");
          await refresh(); // revert on failure
        } finally {
          setActionId(null);
        }
      }
    });
  };

  const handleDelete = (id: string, role: 'technician' | 'citizen' = 'technician') => {
    setConfirmAction({
      title: `Delete ${role === 'technician' ? 'Technician' : 'Citizen'}`,
      message: `Are you sure you want to permanently delete this ${role}? This cannot be undone.`,
      onConfirm: async () => {
        setActionId(id);
        try {
          await del(id, role);
          if (role === 'technician') {
            setTechs(prev => prev.filter(t => t.id !== id));
          } else {
            setCits(prev => prev.filter(c => c.id !== id));
          }
          toast.success(`${role === 'technician' ? 'Technician' : 'Citizen'} deleted`);
        } catch (e: any) {
          toast.error(e.message || `Failed to delete ${role}.`);
          await refresh(); // revert on failure
        } finally {
          setActionId(null);
        }
      }
    });
  };

  const pendingApps = useMemo(() => apps.filter(a => a.status === 'pending'), [apps]);

  const processedTechs = useMemo(() => {
    let filtered = techs;
    if (techSearch.trim()) {
      const q = techSearch.toLowerCase();
      filtered = filtered.filter(t => 
        t.display_name?.toLowerCase().includes(q) || 
        t.email.toLowerCase().includes(q) ||
        t.village?.toLowerCase().includes(q)
      );
    }
    if (techStatus === "active") filtered = filtered.filter(t => !t.banned_until);
    if (techStatus === "suspended") filtered = filtered.filter(t => !!t.banned_until);

    filtered = [...filtered].sort((a, b) => {
      if (techSort === "name") {
        const nameA = a.display_name || a.email;
        const nameB = b.display_name || b.email;
        return techSortDir === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else {
        const timeA = new Date(a.created_at || a.last_sign_in_at || 0).getTime();
        const timeB = new Date(b.created_at || b.last_sign_in_at || 0).getTime();
        return techSortDir === "asc" ? timeA - timeB : timeB - timeA;
      }
    });

    return filtered;
  }, [techs, techSearch, techStatus, techSort, techSortDir]);

  const processedCits = useMemo(() => {
    let filtered = cits;
    if (techSearch.trim()) {
      const q = techSearch.toLowerCase();
      filtered = filtered.filter(c => 
        c.display_name?.toLowerCase().includes(q) || 
        c.email.toLowerCase().includes(q) ||
        c.village?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [cits, techSearch]);

  const techTotalPages = Math.ceil(processedTechs.length / ITEMS_PER_PAGE) || 1;
  const currentTechs = processedTechs.slice((techPage - 1) * ITEMS_PER_PAGE, techPage * ITEMS_PER_PAGE);

  useEffect(() => {
    if (techPage > techTotalPages) setTechPage(techTotalPages);
  }, [techTotalPages, techPage]);

  const citTotalPages = Math.ceil(processedCits.length / ITEMS_PER_PAGE) || 1;
  const currentCits = processedCits.slice((citPage - 1) * ITEMS_PER_PAGE, citPage * ITEMS_PER_PAGE);

  useEffect(() => {
    if (citPage > citTotalPages) setCitPage(citTotalPages);
  }, [citTotalPages, citPage]);

  if (authLoading || (!isAuthority && !authLoading)) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground bg-background">Loading portal…</div>;
  }

  const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4 4 12"/><path d="M4 4l8 8"/></svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {children}
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg text-[13px] font-medium transition-colors">Close</button>
        </div>
      </div>
    </div>
  );

  const SkeletonRow = ({ cols }: { cols: number }) => (
    <tr className="animate-pulse border-b border-border/40 last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4 whitespace-nowrap">
          <div className="h-3.5 bg-muted rounded w-2/3"></div>
        </td>
      ))}
    </tr>
  );

  return (
    <div className="min-h-screen bg-muted/20 text-foreground flex flex-col pt-24 sm:pt-28 pb-10 px-4 sm:px-6">
      
      {/* Settings / Admin Layout Container */}
      <div className="mx-auto w-full max-w-[1300px] flex-1 flex flex-col md:flex-row bg-background border border-border rounded-xl shadow-sm overflow-hidden">
        
        {/* Left Sidebar Sub-navigation */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border shrink-0 flex flex-col bg-muted/10">
          <div className="h-14 border-b border-border flex items-center px-5">
            <Link to="/admin" className="text-[13px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors group">
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" /> Back to Dashboard
            </Link>
          </div>
          <div className="p-4 flex-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">Management</div>
            <nav className="space-y-1">
              <button 
                onClick={() => { setActiveTab('applications'); setTechSearch(""); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors ${activeTab === 'applications' ? 'bg-background border border-border shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'}`}
              >
                <div className="flex items-center gap-2"><FileCheck className="h-4 w-4" /> Pending Approvals</div>
                {pendingApps.length > 0 && <span className="bg-accent text-accent-foreground text-[10px] font-bold px-1.5 rounded-full">{pendingApps.length}</span>}
              </button>
              <button 
                onClick={() => { setActiveTab('technicians'); setTechSearch(""); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors ${activeTab === 'technicians' ? 'bg-background border border-border shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'}`}
              >
                <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Active Technicians</div>
              </button>
              <button 
                onClick={() => { setActiveTab('citizens'); setTechSearch(""); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors ${activeTab === 'citizens' ? 'bg-background border border-border shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'}`}
              >
                <div className="flex items-center gap-2"><User className="h-4 w-4" /> Citizens</div>
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Top Toolbar */}
          <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-background">
            <h1 className="text-[15px] font-semibold text-foreground">
              {activeTab === 'applications' && "Pending Approvals"}
              {activeTab === 'technicians' && "Active Technicians"}
              {activeTab === 'citizens' && "Registered Citizens"}
            </h1>
            
            {activeTab !== 'applications' && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={techSearch}
                    onChange={(e) => { 
                      setTechSearch(e.target.value); 
                      if (activeTab === 'technicians') setTechPage(1); 
                      if (activeTab === 'citizens') setCitPage(1); 
                    }}
                    className="bg-transparent border border-border rounded-md py-1 pl-8 pr-2 text-xs w-[180px] sm:w-[240px] focus:border-accent outline-none focus:ring-1 focus:ring-accent/30 transition-all"
                  />
                </div>
                {activeTab === 'technicians' && (
                  <select
                    value={techStatus}
                    onChange={(e) => { setTechStatus(e.target.value as any); setTechPage(1); }}
                    className="bg-transparent border border-border rounded-md py-1 px-2 text-xs focus:border-accent outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                )}
              </div>
            )}
          </header>

          {/* Table Container */}
          <div className="flex-1 overflow-x-auto bg-background">
            
            {err && (
              <div className="m-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {err}
              </div>
            )}

            {/* TAB: Applications */}
            {activeTab === 'applications' && (
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-border font-medium text-muted-foreground text-xs uppercase bg-muted/10 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 whitespace-nowrap w-12">User</th>
                    <th className="px-6 py-3 whitespace-nowrap">Name</th>
                    <th className="px-6 py-3 whitespace-nowrap">Contact</th>
                    <th className="px-6 py-3 whitespace-nowrap">Registration Date</th>
                    <th className="px-6 py-3 whitespace-nowrap text-center">Document Status</th>
                    <th className="px-6 py-3 whitespace-nowrap text-center">Approval Status</th>
                    <th className="px-6 py-3 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {busy ? (
                    <SkeletonRow cols={7} />
                  ) : pendingApps.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No pending approvals.</td></tr>
                  ) : pendingApps.map(a => (
                    <tr key={a.id} className="hover:bg-accent/5 transition-colors group">
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <Avatar name={a.full_name} email={a.email} className="h-8 w-8 text-xs" />
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap font-medium text-foreground">{a.full_name}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">
                        <div>{a.email}</div>
                        {a.phone && <div className="text-[11px] mt-0.5">{a.phone}</div>}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-center">
                         <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                           a.document_status === 'verified' ? 'bg-green-500/10 text-green-500' :
                           a.document_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                           'bg-yellow-500/10 text-yellow-500'
                         }`}>{a.document_status || 'pending'}</span>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-center">
                         <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500">
                           {a.status}
                         </span>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setViewApp(a)}
                            className="bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors border border-transparent hover:border-border"
                          >
                            View Application
                          </button>
                          <button
                            onClick={() => handleReject(a.id)}
                            disabled={actionId === a.id}
                            className="bg-transparent hover:bg-red-500/10 hover:text-red-500 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors border border-transparent hover:border-red-500/20 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApprove(a.id)}
                            disabled={actionId === a.id}
                            className="bg-accent text-accent-foreground hover:bg-accent/90 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors shadow-sm disabled:opacity-50"
                          >
                            {actionId === a.id ? 'Approving...' : 'Approve'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* TAB: Technicians */}
            {activeTab === 'technicians' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="border-b border-border font-medium text-muted-foreground text-xs uppercase bg-muted/10 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 whitespace-nowrap w-12">User</th>
                        <th className="px-6 py-3 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors group" onClick={() => {
                            if (techSort === "name") setTechSortDir(d => d === "asc" ? "desc" : "asc");
                            else { setTechSort("name"); setTechSortDir("asc"); }
                          }}>
                          <div className="flex items-center gap-1.5">Name <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"/></div>
                        </th>
                        <th className="px-6 py-3 whitespace-nowrap">Contact</th>
                        <th className="px-6 py-3 whitespace-nowrap">Area</th>
                        <th className="px-6 py-3 whitespace-nowrap">Created Date</th>
                        <th className="px-6 py-3 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors group" onClick={() => {
                            if (techSort === "date") setTechSortDir(d => d === "asc" ? "desc" : "asc");
                            else { setTechSort("date"); setTechSortDir("desc"); }
                          }}>
                          <div className="flex items-center gap-1.5">Last Active <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"/></div>
                        </th>
                        <th className="px-6 py-3 whitespace-nowrap">Status</th>
                        <th className="px-6 py-3 whitespace-nowrap text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {busy ? (
                        <SkeletonRow cols={8} />
                      ) : currentTechs.length === 0 ? (
                        <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No active technicians match your search.</td></tr>
                      ) : currentTechs.map(t => {
                        const isBanned = !!t.banned_until;
                        return (
                          <tr key={t.id} className={`hover:bg-accent/5 transition-colors group ${isBanned ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                            <td className="px-6 py-3.5 whitespace-nowrap">
                              <Avatar name={t.display_name} email={t.email} className="h-8 w-8 text-xs" />
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap">
                              <div className="font-medium text-foreground">{t.display_name || '—'}</div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{t.id.slice(0,8)}</div>
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">
                              <div>{t.email}</div>
                              {t.phone && <div className="text-[11px] mt-0.5">{t.phone}</div>}
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">{t.village || '—'}</td>
                            <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">
                              {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">
                              {t.last_sign_in_at ? new Date(t.last_sign_in_at).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap">
                               {isBanned ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500">Suspended</span>
                               ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-500">Active</span>
                               )}
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setViewTech(t)}
                                  className="bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border border-transparent hover:border-border"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => alert("Editing technician is not yet implemented.")}
                                  className="bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border border-transparent hover:border-border"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleBan(t.id, t.banned_until)}
                                  disabled={actionId === t.id}
                                  className="bg-background border border-border hover:bg-muted text-foreground px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors shadow-sm disabled:opacity-50"
                                >
                                  {isBanned ? "Restore" : "Suspend"}
                                </button>
                                <button
                                  onClick={() => handleDelete(t.id)}
                                  disabled={actionId === t.id}
                                  className="bg-background border border-border hover:border-red-500/30 hover:bg-red-500/10 text-red-500 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors shadow-sm disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination Toolbar */}
                {techTotalPages > 1 && (
                  <div className="border-t border-border bg-muted/10 px-6 py-3 flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-muted-foreground font-medium">Showing {(techPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(techPage * ITEMS_PER_PAGE, processedTechs.length)} of {processedTechs.length}</span>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setTechPage(p => Math.max(1, p - 1))} disabled={techPage === 1} className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-30 shadow-sm"><ChevronLeft className="h-3 w-3"/></button>
                        <span className="text-[11px] font-semibold px-2">Page {techPage} / {techTotalPages}</span>
                        <button onClick={() => setTechPage(p => Math.min(techTotalPages, p + 1))} disabled={techPage === techTotalPages} className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-30 shadow-sm"><ChevronRight className="h-3 w-3"/></button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Citizens */}
            {activeTab === 'citizens' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="border-b border-border font-medium text-muted-foreground text-xs uppercase bg-muted/10 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 whitespace-nowrap w-12">User</th>
                        <th className="px-6 py-3 whitespace-nowrap">Name</th>
                        <th className="px-6 py-3 whitespace-nowrap">Contact</th>
                        <th className="px-6 py-3 whitespace-nowrap">Region</th>
                        <th className="px-6 py-3 whitespace-nowrap">Joined Date</th>
                        <th className="px-6 py-3 whitespace-nowrap text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {busy ? (
                        <SkeletonRow cols={6} />
                      ) : currentCits.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No citizens match your search.</td></tr>
                      ) : currentCits.map(c => (
                        <tr key={c.id} className="hover:bg-accent/5 transition-colors group">
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <Avatar name={c.display_name} email={c.email} className="h-8 w-8 text-xs" />
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <div className="font-medium text-foreground">{c.display_name || 'Anonymous'}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.id.slice(0,8)}</div>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">
                            <div>{c.email}</div>
                            {c.phone && <div className="text-[11px] mt-0.5">{c.phone}</div>}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">{c.village || '—'}</td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setViewCit(c)}
                                className="bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors border border-transparent hover:border-border"
                              >
                                View Profile
                              </button>
                              <button
                                onClick={() => handleDelete(c.id, 'citizen')}
                                disabled={actionId === c.id}
                                className="bg-background border border-border hover:border-red-500/30 hover:bg-red-500/10 text-red-500 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors shadow-sm disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination Toolbar */}
                {citTotalPages > 1 && (
                  <div className="border-t border-border bg-muted/10 px-6 py-3 flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-muted-foreground font-medium">Showing {(citPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(citPage * ITEMS_PER_PAGE, processedCits.length)} of {processedCits.length}</span>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setCitPage(p => Math.max(1, p - 1))} disabled={citPage === 1} className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-30 shadow-sm"><ChevronLeft className="h-3 w-3"/></button>
                        <span className="text-[11px] font-semibold px-2">Page {citPage} / {citTotalPages}</span>
                        <button onClick={() => setCitPage(p => Math.min(citTotalPages, p + 1))} disabled={citPage === citTotalPages} className="p-1.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-30 shadow-sm"><ChevronRight className="h-3 w-3"/></button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>

      </div>

      {viewApp && (
        <Modal title="Pending Application Details" onClose={() => setViewApp(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={viewApp.full_name} email={viewApp.email} className="h-12 w-12 text-lg" />
              <div>
                <div className="font-semibold text-[15px]">{viewApp.full_name}</div>
                <div className="text-muted-foreground">{viewApp.email}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground text-xs block">Phone</span>{viewApp.phone || '—'}</div>
              <div><span className="text-muted-foreground text-xs block">Region</span>{viewApp.region || '—'}</div>
              <div><span className="text-muted-foreground text-xs block">Skill</span>{viewApp.technical_skill || '—'}</div>
              <div><span className="text-muted-foreground text-xs block">Vehicle</span>{viewApp.vehicle_available ? 'Yes' : 'No'}</div>
            </div>
            <div className="grid grid-cols-2 gap-y-4 text-sm mt-4">
              <div><span className="text-muted-foreground text-xs block">Document Status</span>{viewApp.document_status || 'pending'}</div>
              <div><span className="text-muted-foreground text-xs block">Applied Date</span>{new Date(viewApp.created_at).toLocaleString()}</div>
            </div>
          </div>
        </Modal>
      )}

      {viewTech && (
        <Modal title="Technician Profile" onClose={() => setViewTech(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={viewTech.display_name} email={viewTech.email} className="h-12 w-12 text-lg" />
              <div>
                <div className="font-semibold text-[15px]">{viewTech.display_name}</div>
                <div className="text-muted-foreground">{viewTech.email}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground text-xs block">Phone</span>{viewTech.phone || '—'}</div>
              <div><span className="text-muted-foreground text-xs block">Area/Village</span>{viewTech.village || '—'}</div>
              <div><span className="text-muted-foreground text-xs block">Status</span>{viewTech.banned_until ? 'Suspended' : 'Active'}</div>
              <div><span className="text-muted-foreground text-xs block">Last Sign In</span>{viewTech.last_sign_in_at ? new Date(viewTech.last_sign_in_at).toLocaleString() : 'Never'}</div>
              <div><span className="text-muted-foreground text-xs block">Created</span>{viewTech.created_at ? new Date(viewTech.created_at).toLocaleString() : '—'}</div>
              <div><span className="text-muted-foreground text-xs block">User ID</span><span className="font-mono text-xs">{viewTech.id}</span></div>
            </div>
          </div>
        </Modal>
      )}

      {viewCit && (
        <Modal title="Citizen Profile" onClose={() => setViewCit(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={viewCit.display_name} email={viewCit.email} className="h-12 w-12 text-lg" />
              <div>
                <div className="font-semibold text-[15px]">{viewCit.display_name || 'Anonymous'}</div>
                <div className="text-muted-foreground">{viewCit.email}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground text-xs block">Phone</span>{viewCit.phone || '—'}</div>
              <div><span className="text-muted-foreground text-xs block">Region</span>{viewCit.village || '—'}</div>
              <div className="col-span-2"><span className="text-muted-foreground text-xs block">Joined Date</span>{new Date(viewCit.created_at).toLocaleString()}</div>
              <div className="col-span-2"><span className="text-muted-foreground text-xs block">User ID</span><span className="font-mono text-xs">{viewCit.id}</span></div>
            </div>
          </div>
        </Modal>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-sm flex flex-col p-6">
            <h2 className="font-semibold text-foreground mb-2">{confirmAction.title}</h2>
            <p className="text-sm text-muted-foreground mb-6">{confirmAction.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg text-[13px] font-medium transition-colors">Cancel</button>
              <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg text-[13px] font-medium transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
