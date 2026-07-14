# SevaJyothi

**Offline-First Rural Infrastructure Intelligence Platform**

SevaJyothi is a production-grade infrastructure intelligence system designed to solve one of the largest operational gaps in rural governance: delayed reporting, fragmented communication, and infrastructure repair inefficiency in low-connectivity regions.

Built as an enterprise-grade distributed system, SevaJyothi enables citizens, government authorities, and field technicians to collaborate through a real-time, offline-capable infrastructure reporting network optimized for low-bandwidth environments.

This is not a traditional CRUD application.

It is a resilient multi-role operational platform engineered for real-world deployment in rural environments where network instability, delayed communication, and infrastructure downtime directly impact communities.

---

# Problem Statement

Large portions of rural India, especially remote districts and villages, face persistent infrastructure failures.

Common issues include:

- Transformer explosions causing long-term power outages
- Water pipeline leaks reducing supply availability
- Road degradation affecting transportation access
- Street light outages compromising safety
- Sewage leakages creating health risks
- Mobile network tower failures cutting digital access entirely

The current reporting workflow is fundamentally inefficient.

Existing process:

Citizen notices issue
→ manually informs local authority
→ delayed manual logging
→ technician assignment happens late
→ no transparent tracking
→ repeated follow-ups required
→ resolution delays can extend for days

Critical limitations of current systems:

- No real-time complaint pipeline
- No accountability chain
- No infrastructure for low-network rural environments
- No offline reporting capability
- No intelligent technician routing
- No operational analytics for recurring failures
- No transparent citizen-to-authority communication

The result is infrastructure downtime, delayed repairs, and poor operational efficiency.

---

# Proposed Solution

SevaJyothi introduces a distributed infrastructure management platform designed specifically for low-connectivity rural regions.

The system enables:

- Citizens to report infrastructure failures instantly
- Complaints to persist offline when internet is unavailable
- Automatic background synchronization once connectivity returns
- Authorities to monitor live infrastructure incidents
- Intelligent technician assignment based on workload and proximity
- Real-time status propagation across all stakeholders
- Persistent audit trails across the complaint lifecycle
- Predictive infrastructure intelligence through failure clustering

The system works even when network access is unreliable.

---

# System Architecture

The platform follows a distributed event-driven architecture.

```text
Citizen Device
(PWA + IndexedDB)

↓

Offline Queue Engine
(Background Sync API + Local Persistence)

↓

Backend Provider Layer
(Adapter Architecture)

↓

Authentication Layer
(Supabase Auth)

↓

PostgreSQL Database
(RLS + Triggers + Realtime Publications)

↓

Realtime Event Bus
(Postgres Changes + WebSockets)

↓

Role Specific Systems

Citizen Dashboard
Authority Command Center
Technician Field Operations App

↓

Notification Pipeline
(Database Trigger → Push Worker → Browser Push API)

↓

Infrastructure Analytics Engine
(Predictive Risk + Geographic Clustering)
```

---

# Core Product Philosophy

The platform is designed around one assumption.

Connectivity cannot be trusted.

Traditional systems assume internet availability.

SevaJyothi assumes:

- Internet may disappear entirely
- Technicians may work in remote zones
- Citizens may submit complaints without network access
- Devices may reconnect hours later
- Data loss must never occur

This led to an offline-first architecture rather than cloud-first architecture.

---

# Technology Stack

## Frontend

- React
- TypeScript
- TailwindCSS
- Framer Motion
- TanStack Router
- Progressive Web App Architecture

## Backend

- Supabase PostgreSQL
- Row Level Security Policies
- Database Triggers
- Realtime Subscriptions
- Storage Buckets
- RPC Functions

## Offline Engine

- IndexedDB
- Service Workers
- Background Sync API
- Persistent Storage API
- Exponential Retry Queue

## Infrastructure Layer

- Adapter Pattern Backend Architecture
- Provider-Based Database Layer
- Storage Provider Abstraction
- Authentication Provider Layer
- Realtime Provider Layer

## Geospatial Layer

- Leaflet Maps
- OpenStreetMap Tiles
- Route Optimization Logic
- Technician Distance Calculation
- GPS Accuracy Validation

## Security

- Row Level Security
- Role Isolation Policies
- Storage Access Policies
- Authenticated JWT Sessions
- SQL Trigger Security Controls
- Database Rate Limiting

---

# Multi Role System

The platform operates through three independent operational roles.

## Citizen

Primary responsibility:

Infrastructure reporting.

Capabilities:

- Submit complaint
- Upload infrastructure images
- Capture GPS coordinates
- Track complaint status
- Receive technician updates
- Receive push notifications
- Offline complaint submission

---

## Authority (Admin)

Primary responsibility:

Operational command center.

Capabilities:

- View live complaint feed
- Access geographic incident map
- Assign technician resources
- Monitor infrastructure analytics
- View recurring infrastructure failure zones
- Track technician utilization
- Receive live critical alerts

---

## Technician

Primary responsibility:

Field resolution execution.

Capabilities:

- Receive assignment notifications
- View assigned infrastructure faults
- Open navigation route
- Access live destination map
- Start repair workflow
- Upload proof images
- Mark repair completion
- Sync offline updates later

---

# System Workflow

The platform follows an event-driven distributed workflow.

## Complaint Submission

Citizen observes infrastructure failure.

```text
User selects issue category

↓

GPS location captured

↓

Optional image uploaded

↓

Description entered

↓

Network unavailable?
```

If online:

```text
Immediately persist to cloud
```

If offline:

```text
Store inside IndexedDB queue
```

Then:

```text
Background Sync waits

↓

Internet restored

↓

Automatic cloud synchronization
```

---

## Authority Workflow

```text
Complaint enters PostgreSQL

↓

Database trigger computes severity score

↓

Realtime event published

↓

Authority dashboard updates instantly

↓

Authority reviews issue

↓

Technician assigned

↓

Assignment notification created
```

---

## Technician Workflow

```text
Technician receives assignment

↓

Realtime dashboard update

↓

Map route generated

↓

Technician navigates to destination

↓

Repair started

↓

Repair status updated

↓

Proof image uploaded

↓

Repair marked resolved
```

---

## Citizen Update Flow

```text
Technician marks repair complete

↓

Database trigger executes

↓

Notification created

↓

Push notification delivered

↓

Citizen dashboard updates instantly

↓

Complaint lifecycle marked completed
```

---

# Security Architecture

Security is enforced at database level rather than UI level.

Implemented protections:

- User cannot read another citizen's complaints
- Technician cannot access unassigned infrastructure reports
- Unauthorized role escalation blocked
- Storage bucket protected with path-level access policies
- Rate limiting enforced inside PostgreSQL triggers
- Duplicate complaint replay prevented using unique client identifiers
- Realtime subscriptions restricted by role-specific policies

No client-side security assumptions exist.

---

# Why Offline First

Most infrastructure reporting systems assume stable internet connectivity.

This assumption fails in remote operational environments.

SevaJyothi was built around offline-first principles.

Guarantees:

- No data loss during connectivity failure
- Complaint persistence survives browser restart
- Background synchronization retries automatically
- Field operations continue without network dependency

The system prioritizes resilience over convenience.

---

# Open Source Philosophy

The project is intentionally built with provider abstraction.

No direct vendor dependency exists at architecture level.

Backend integrations operate through provider adapters.

Supported future migration paths:

- Supabase
- Self-hosted PostgreSQL
- Node.js + Express backend
- Custom enterprise infrastructure
- Cloudflare Workers
- Dedicated microservice architecture

This allows infrastructure ownership without vendor lock-in.

The system is designed to remain portable.

---

# Current Engineering State

Current implementation status.

Completed:

- Production-grade authentication
- Role-based access architecture
- Realtime PostgreSQL subscriptions
- Offline IndexedDB persistence
- Background sync queue
- Service worker infrastructure
- Progressive Web App support
- Push notification pipeline
- Multi-role dashboards
- Geospatial infrastructure reporting
- Database triggers
- Security policies
- Rate limiting
- Image compression pipeline
- Realtime notification system
- Technician workflow engine
- Predictive infrastructure analytics

In progress:

- Advanced technician route optimization
- Geographic heatmap intelligence
- Full ownership backend migration
- Bundle size optimization
- Infrastructure anomaly prediction engine

---

# Why This Exists

Infrastructure repair delays in rural communities are rarely caused by technical inability.

They are caused by fragmented communication systems.

SevaJyothi reduces the time between:

Problem detection
and
Problem resolution.

The objective is operational efficiency under unreliable connectivity conditions.

Not merely issue reporting.

---

# Future Roadmap

Planned engineering improvements.

Phase II

- AI-based infrastructure anomaly prediction
- Infrastructure failure heatmaps
- Technician route optimization engine
- District-wide infrastructure analytics
- Predictive maintenance engine

Phase III

- IoT transformer monitoring
- Automated anomaly detection
- Government department integration
- Multi-district deployment architecture
- Centralized infrastructure intelligence dashboard

---

# Engineering Principle

Build systems assuming failure.

Assume network failure.

Assume device suspension.

Assume concurrent writes.

Assume unreliable infrastructure.

Design systems that continue functioning regardless.

SevaJyothi was built around resilience engineering.

---

# License

Open Source.

Infrastructure for public systems should remain transparent, portable, and auditable.

---

SevaJyothi

Distributed infrastructure intelligence for resilient communities.
