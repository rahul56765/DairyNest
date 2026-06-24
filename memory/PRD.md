# DairyNest — Product Requirements Document

_Last updated: 2026-06-24_

## Original Problem Statement
A subscription platform for Fresh Milk, Organic Vegetables & Fruits with Morning/Evening delivery and UPI AutoPay recurring subscriptions. Three apps in one: Customer App, Super Admin Panel, Delivery Agent Panel.

## Architecture
- **Frontend**: Expo (React Native) + expo-router file-based routing. Single app, 3 role-based experiences routed by JWT role after phone-OTP login.
- **Backend**: FastAPI + MongoDB (motor). UUID string ids, `/api` prefixed routes, JWT auth (30d), role guards (customer/agent/admin).
- **Integrations**: Twilio Verify (OTP — DEV fallback `123456` until auth token provided), Razorpay TEST keys (real order creation; confirmation simulated in Expo Go), Emergent LLM Gemini-3-Flash (AI insights & demand forecast).
- **Design**: Fresh/natural green+cream theme; Fraunces (display) + Plus Jakarta Sans (body); Phosphor icons.

## User Personas
- **Customer (Neeraj)** — wants daily milk + produce on autopilot via UPI AutoPay.
- **Delivery Agent (Ramesh)** — sees only assigned route/stops, marks deliveries, attendance.
- **Super Admin** — full business control: KPIs, customers, orders, inventory, referrals, AI forecast, tickets.

## Demo Accounts (OTP 123456)
Customer 9000000001 · Agent 9000000002 · Admin 9000000003

## Implemented (v1 — 2026-06-24)
- Onboarding carousel, phone OTP login + registration with referral.
- **Customer**: Home dashboard (greeting, hero offer, quick actions, morning/evening delivery, AI insight), Milk subscription (Cow/Buffalo/A2, qty incl. custom, schedule, frequency, pause/resume/skip), Veg/Fruit catalog w/ category chips, product page (one-time/weekly/monthly), Cart + coupons, Checkout (slot + UPI/Card/NetBanking/COD), UPI AutoPay dashboard, Orders + tracking timeline, Rewards (code/share/funnel), Coupons, Billing + PDF invoice, Support tickets, Profile.
- **Agent**: Today's route grouped by apartment, delivered/failed actions, issue report, attendance check-in/out, performance.
- **Admin**: Dashboard KPIs + 7-day sales chart, customers suspend/activate, orders assign+status, products disable, inventory + low-stock, referrals, coupons, tickets resolve, AI demand forecast.
- 33/33 backend tests passing; all 3 UI flows verified.

## Backlog
- **P1**: Real Razorpay native checkout (needs dev build), live Twilio OTP (needs auth token), bulk admin actions (pause/resume multiple, price revision), apartment management screen, manager panel + granular permission engine.
- **P2**: Address add/edit UI, skip-date-range picker UI, weekly/monthly basket builder, consumption analytics charts, audit logs, bulk WhatsApp/SMS/email center, GST credit/debit notes, route optimization & agent live location.

## Next Tasks
1. Top up Emergent Universal Key balance so AI insights/forecast use live Gemini (currently falling back to canned text — budget exhausted).
2. Provide Twilio auth token to switch OTP from DEV to live SMS.
3. Build address management + skip-range UI (deferred from v1).
