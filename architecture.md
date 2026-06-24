# DairyNest — Architecture

_Last updated: 2026-06-26_

Subscription platform for **Fresh Milk, Organic Vegetables & Fruits** with morning/evening delivery and UPI AutoPay. A single Expo app serves **4 role-based experiences** (customer, agent, admin, manager) routed by JWT role after phone-OTP login.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Expo (React Native) + expo-router (file-based routing) |
| State/Auth | React Context (`src/auth.tsx`) + JWT in SecureStore |
| Backend | FastAPI + APIRouter (`/api` prefix) |
| Database | MongoDB via `motor` (async), UUID string ids |
| Auth | JWT (30d) over phone OTP; role guards |
| Integrations | Twilio Verify (OTP), Razorpay (TEST), Emergent LLM (Gemini-3-Flash) |
| Fonts/Icons | Fraunces + Plus Jakarta Sans; phosphor-react-native |

---

## 2. Directory Map

```
/app
├── backend/
│   ├── server.py            # ALL backend logic (~1304 lines): FastAPI app, auth, role guards,
│   │                        #   OTP, payments, products, subs, cart, orders, agent/admin/manager APIs
│   ├── requirements.txt
│   ├── .env                 # MONGO_URL, DB_NAME, JWT_SECRET, TWILIO_*, RAZORPAY_*, EMERGENT_LLM_KEY
│   └── tests/test_dairynest.py
├── frontend/
│   ├── app/                 # expo-router routes
│   │   ├── _layout.tsx      # Root: AuthProvider, fonts, toast, Stack
│   │   ├── index.tsx        # Boot redirect → role home or onboarding/login
│   │   ├── onboarding.tsx, login.tsx, register.tsx
│   │   ├── (customer)/      # Tabs: home, subscription, orders, rewards, profile + _layout
│   │   ├── (agent)/         # Tabs: route, attendance, performance + _layout
│   │   ├── (admin)/         # Tabs: dashboard, customers, orders, more + _layout
│   │   ├── (manager)/       # Tabs: dashboard, customers, orders, more + _layout (permission-gated)
│   │   ├── product/[id].tsx, order/[id].tsx     # detail screens
│   │   ├── catalog.tsx, cart.tsx, checkout.tsx  # shopping flow
│   │   ├── autopay.tsx, milk-config.tsx         # subscription/autopay
│   │   ├── addresses.tsx, billing.tsx, coupons.tsx, support.tsx
│   │   └── +html.tsx
│   └── src/
│       ├── api.ts           # fetch wrapper; BASE = EXPO_PUBLIC_BACKEND_URL + /api; bearer token
│       ├── auth.tsx         # AuthProvider/useAuth + homeRouteForRole()
│       ├── theme.ts         # colors, spacing, radius, font, type, shadow tokens
│       ├── components/ui.tsx, components/toast.tsx
│       ├── hooks/use-icon-fonts.ts
│       └── utils/storage/   # SecureStore wrapper (web fallback)
├── memory/PRD.md, memory/test_credentials.md
├── design_guidelines.md / .json
└── architecture.md          # this file
```

---

## 3. Authentication & RBAC

- **Login flow:** phone → `POST /auth/send-otp` → enter OTP → `POST /auth/verify-otp` → JWT.
- **OTP:** Twilio Verify is LIVE. Dev fallback **`123456`** accepted for any number (trial Twilio only sends to verified numbers).
- **Roles:** `customer`, `agent`, `admin`, `manager`.
- **Manager:** a restricted admin with a `permissions` map (e.g. `{customers, orders, products, inventory, marketing, support}`). Tabs/endpoints gate on these flags. Role guard in `server.py` (~line 99) allows `manager` when the requested module permission is set.
- **Redirects:** `homeRouteForRole()` → agent→`/(agent)/route`, admin→`/(admin)/dashboard`, manager→`/(manager)/dashboard`, else customer→`/(customer)/home`.
- **Token:** stored via SecureStore key `dn_token`; auto-bootstrapped on app launch via `/auth/me`.

> ⚠️ `src/auth.tsx` `User.role` type currently lists only `customer|agent|admin` — `manager` is handled in routing but missing from the TS union. Keep in mind for type accuracy.

---

## 4. Backend API Surface (all prefixed `/api`)

**Auth/Profile:** `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/register`, `GET /auth/me`, `PUT /profile`
**Addresses:** `POST /addresses`, `PUT /addresses/{id}/default`, `DELETE /addresses/{id}`
**Catalog:** `GET /products`, `GET /products/categories`, `GET /products/{pid}`
**Subscriptions:** `GET/POST /subscriptions`, `PUT /subscriptions/{sid}`, `POST .../pause|resume|skip-tomorrow|skip-range`, `DELETE /subscriptions/{sid}`
**AutoPay (UPI mandate):** `GET /autopay`, `POST /autopay/setup|pause|resume|cancel`
**Cart/Coupons:** `GET /cart`, `POST /cart/add`, `PUT /cart/item`, `DELETE /cart/item/{pid}`, `POST /cart/apply-coupon`, `DELETE /cart/coupon`, `GET /coupons`, `POST /coupons/validate`
**Orders:** `POST /orders/checkout`, `POST /orders/{oid}/confirm-payment`, `GET /orders`, `GET /orders/{oid}`
**Referrals/Billing/Tickets:** `GET /referrals/me`, `GET /billing/monthly`, `GET/POST /tickets`, `POST /tickets/{tid}/reply`
**AI:** `GET /ai/insights`, `GET /admin/ai-predictions`
**Agent:** `GET /agent/summary|route|performance`, `POST /agent/delivery/{oid}/status`, `POST /agent/issue`, `POST /agent/attendance/checkin|checkout`, `GET /agent/attendance/today`
**Admin:** `GET /admin/dashboard`, customers (`GET`, `PUT .../suspend|activate`), orders (`GET`, `PUT .../status|assign`), `GET /admin/agents`, products CRUD, inventory (`GET`, `PUT .../stock`), `GET /admin/referrals|coupons`, `POST /admin/coupons`, tickets (`GET`, `PUT .../status`)
**Manager admin:** `GET /manager/me`, and admin endpoints reused under permission gating. Manager management (admin-only): `GET /admin/managers`, `POST /admin/managers`, `PUT /admin/managers/{mid}/permissions|toggle`
**Misc:** `GET /` (health), `GET /config` (public keys), startup seeder (products, coupons, demo users).

---

## 5. MongoDB Collections

`users`, `products`, `subscriptions`, `mandates` (autopay), `carts`, `coupons`, `orders`, `referrals`, `tickets`, `agent_issues`, `attendance`, `otps`.

**Key shapes:**
- `users`: `{id, phone, role, name, email?, addresses[], default_address_id, permissions{}, employee_id?, referral_code, referred_by_code?, suspended?, preferences{}}`
- `orders`: `{id, customerId, agentId?, items[{product, qty}], amount, discount, delivery_charge, status, payment_status, type, slot, address, created_at}`
- `products`: `{id, name, category, type(milk/veg/fruit), price, stock, image, active}`
- `subscriptions`: `{id, customerId, productId, qty, schedule(morning/evening), frequency, status(active/paused), skip_dates[]}`

---

## 6. Integrations

| Service | Mode | Notes |
|---------|------|-------|
| Twilio Verify | LIVE | Real SMS OTP; `123456` dev fallback always works. Admin `6398213389` gets real SMS. |
| Razorpay | TEST keys | Real order creation; **payment confirmation SIMULATED** in Expo Go (native checkout needs dev build). |
| Emergent LLM (Gemini-3-Flash) | LIVE (key) | AI insights + admin demand/churn predictions. Falls back to canned text if key budget exhausted. |

Env keys (backend/.env): `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `EMERGENT_LLM_KEY`.

---

## 7. Demo Credentials

| Role | Phone | OTP |
|------|-------|-----|
| Customer | 9000000001 | 123456 |
| Agent | 9000000002 | 123456 |
| Super Admin | 6398213389 | live SMS or 123456 fallback |

Coupons seeded: `WELCOME50`, `FRESH20`, `MILK10`.

---

## 8. Design System

Fresh/natural **green + cream** palette (`brandPrimary #3A5940`, `surface #FCFAF8`). 8pt spacing grid, radius tokens (sm/md/lg/pill), card shadow. Fonts: Fraunces (display) + Plus Jakarta Sans (body). Shared primitives in `src/components/ui.tsx` (`Txt`, `Header`, `Card`, `Button`, `Row`, `Badge`). Tab bars apply `useSafeAreaInsets()` bottom padding to clear Android 3-button nav.

---

## 9. Conventions

- All backend routes under `APIRouter(prefix="/api")`, included once via `app.include_router(api)`.
- Frontend never hardcodes URLs — uses `EXPO_PUBLIC_BACKEND_URL`.
- UUID string ids everywhere (no Mongo ObjectId leakage).
- New navigable screens → files under `frontend/app/`. Shared/non-route code → `frontend/src/`.
- Edit existing files with targeted replacements; reuse `ui.tsx` primitives and `theme.ts` tokens.
