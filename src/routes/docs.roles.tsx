import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Users, ShieldCheck, Wrench } from "lucide-react";

export const Route = createFileRoute("/docs/roles")({
  head: () => ({ meta: [{ title: "Three-role model · SevaJyothi" }] }),
  component: RolesDoc,
});

function RolesDoc() {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
      <Link to="/docs" className="mb-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground" data-cursor="link">
        <ArrowLeft className="h-4 w-4" /> Documentation
      </Link>
      <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">Roles</div>
      <h1 className="mt-2 text-display text-[clamp(2rem,4vw,3rem)]">Three roles, one fabric</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Roles are stored in <code className="text-mono-data">public.user_roles</code> and checked through the SECURITY-DEFINER <code className="text-mono-data">has_role()</code> function — never via JWT claims, to avoid privilege escalation.
      </p>
      <div className="mt-10 grid gap-4">
        <Block icon={Users} title="Citizen"
          body="Files reports. Sees only their own complaints. Default role auto-assigned on signup by an auth trigger." />
        <Block icon={ShieldCheck} title="Authority"
          body="Reads every incident. Triages, assigns to technicians, sets priority, escalates SLA breaches. Granted manually by an administrator." />
        <Block icon={Wrench} title="Technician"
          body="Sees only jobs assigned to them. Updates field status (en route, on site), uploads repair-proof photos, marks resolution." />
      </div>
    </article>
  );
}

function Block({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-6" data-cursor="card">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-display text-[20px]">{title}</div>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
