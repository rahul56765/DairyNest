import os
import uuid
import random
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date

import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"

# Integrations config
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_VERIFY = os.environ.get("TWILIO_VERIFY_SERVICE_SID", "")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

TWILIO_LIVE = bool(TWILIO_SID and TWILIO_TOKEN and "-" not in TWILIO_TOKEN and len(TWILIO_TOKEN) > 10 and TWILIO_VERIFY)
RAZORPAY_LIVE = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dairynest")

app = FastAPI(title="DairyNest API")
api = APIRouter(prefix="/api")


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.isoformat() if isinstance(dt, datetime) else dt


def new_id():
    return str(uuid.uuid4())


def clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ------------------- Push Notifications -------------------
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_expo_push(tokens: List[str], title: str, body: str, data: Optional[Dict[str, Any]] = None):
    """Send a push notification to one or more Expo push tokens via Expo Push API."""
    tokens = [t for t in (tokens or []) if t and t.startswith("ExponentPushToken")]
    if not tokens:
        return {"sent": 0, "skipped": True}
    messages = [
        {
            "to": t,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
            "channelId": "default",
            "vibrate": [0, 250, 250, 250],
        }
        for t in tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=8.0) as cx:
            r = await cx.post(EXPO_PUSH_URL, json=messages, headers={"Accept": "application/json", "Content-Type": "application/json"})
            logger.info(f"Expo push -> {len(tokens)} tokens, status={r.status_code}")
            return {"sent": len(tokens), "response": r.status_code}
    except Exception as e:
        logger.error(f"Expo push error: {e}")
        return {"sent": 0, "error": str(e)}


async def notify_user(user_id: str, title: str, body: str, data: Optional[Dict[str, Any]] = None, log: bool = True):
    """Look up user's push tokens and send notification + persist to history."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return {"sent": 0, "missing_user": True}
    tokens = user.get("push_tokens", []) or []
    result = await send_expo_push(tokens, title, body, data)
    if log:
        await db.notifications.insert_one({
            "id": new_id(), "user_id": user_id, "title": title, "body": body,
            "data": data or {}, "created_at": iso(now_utc()), "read": False,
        })
    return result


async def notify_role(role: str, title: str, body: str, data: Optional[Dict[str, Any]] = None):
    """Broadcast to every user with the given role (or 'all')."""
    q = {} if role == "all" else {"role": role}
    cursor = db.users.find(q, {"id": 1, "push_tokens": 1})
    all_tokens = []
    user_ids = []
    async for u in cursor:
        user_ids.append(u["id"])
        all_tokens.extend(u.get("push_tokens", []) or [])
    # Send to all tokens at once (Expo accepts up to 100 per batch)
    sent_total = 0
    for i in range(0, len(all_tokens), 100):
        batch = all_tokens[i:i + 100]
        res = await send_expo_push(batch, title, body, data)
        sent_total += res.get("sent", 0)
    # Persist a notification record for each user
    if user_ids:
        await db.notifications.insert_many([
            {"id": new_id(), "user_id": uid, "title": title, "body": body,
             "data": data or {}, "created_at": iso(now_utc()), "read": False}
            for uid in user_ids
        ])
    return {"sent": sent_total, "recipients": len(user_ids)}



# ------------------------- Auth helpers -------------------------
def make_token(user_id: str, role: str):
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return clean(user)


def require_role(*roles):
    async def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker


def admin_or_manager(module: Optional[str] = None):
    async def checker(user=Depends(get_current_user)):
        if user["role"] == "admin":
            return user
        if user["role"] == "manager" and (module is None or user.get("permissions", {}).get(module)):
            return user
        raise HTTPException(status_code=403, detail="Forbidden")
    return checker


async def strict_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user


# ------------------------- Models -------------------------
class SendOtp(BaseModel):
    phone: str


class VerifyOtp(BaseModel):
    phone: str
    code: str


class Address(BaseModel):
    id: str = Field(default_factory=new_id)
    label: str = "Home"
    apartment: str = ""
    flat: str = ""
    floor: str = ""
    landmark: str = ""
    area_name: str = ""  # reverse-geocoded readable area (e.g. "MG Road, Bengaluru")
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = True


class Register(BaseModel):
    phone: str
    name: str
    email: Optional[str] = ""
    apartment: str = ""
    flat: str = ""
    floor: str = ""
    landmark: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    referral_code: Optional[str] = ""
    role: str = "customer"


class SubscriptionIn(BaseModel):
    product_id: str
    milk_type: str
    quantity_label: str
    quantity_ml: int
    schedule: str  # morning / evening / both
    frequency: str  # daily / alternate / weekly


class SubModify(BaseModel):
    quantity_label: Optional[str] = None
    quantity_ml: Optional[int] = None
    milk_type: Optional[str] = None
    schedule: Optional[str] = None
    frequency: Optional[str] = None


class SkipRange(BaseModel):
    start: str
    end: str


class CartItemIn(BaseModel):
    product_id: str
    qty: int = 1


class CheckoutIn(BaseModel):
    slot: str = "morning"
    payment_method: str = "upi"
    address_id: Optional[str] = None


class CouponValidate(BaseModel):
    code: str
    amount: float


class AutoPayIn(BaseModel):
    max_amount: float
    app: str = "Google Pay"


class TicketIn(BaseModel):
    category: str
    subject: str
    message: str


class TicketReply(BaseModel):
    message: str


class DeliveryStatusIn(BaseModel):
    status: str
    otp: Optional[str] = None
    photo: Optional[str] = None
    note: Optional[str] = None


class IssueIn(BaseModel):
    order_id: Optional[str] = None
    category: str
    note: str = ""


class ProductIn(BaseModel):
    type: str
    category: str
    name: str
    image: str = ""
    weight: str = ""
    price: float = 0
    unit: str = ""
    farm_source: str = ""
    organic: bool = False
    stock: int = 100
    milk_type: Optional[str] = None
    availability: bool = True


class ProfileIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


# ------------------------- OTP -------------------------
def gen_ref_code(name: str):
    base = "".join([c for c in name.upper() if c.isalpha()])[:6] or "DAIRY"
    return f"{base}{random.randint(100, 999)}"


@api.post("/auth/send-otp")
async def send_otp(body: SendOtp):
    phone = body.phone.strip()
    if TWILIO_LIVE:
        try:
            from twilio.rest import Client as TwilioClient
            tc = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
            to = phone if phone.startswith("+") else f"+91{phone}"
            tc.verify.v2.services(TWILIO_VERIFY).verifications.create(to=to, channel="sms")
            return {"status": "sent", "mode": "live"}
        except Exception as e:
            logger.error(f"Twilio send failed: {e}")
    # DEV fallback
    code = "123456"
    await db.otps.update_one(
        {"phone": phone}, {"$set": {"code": code, "created_at": iso(now_utc())}}, upsert=True
    )
    return {"status": "sent", "mode": "dev", "dev_code": code}


@api.post("/auth/verify-otp")
async def verify_otp(body: VerifyOtp):
    phone = body.phone.strip()
    ok = False
    if TWILIO_LIVE:
        try:
            from twilio.rest import Client as TwilioClient
            tc = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
            to = phone if phone.startswith("+") else f"+91{phone}"
            check = tc.verify.v2.services(TWILIO_VERIFY).verification_checks.create(to=to, code=body.code)
            ok = check.status == "approved"
        except Exception as e:
            logger.error(f"Twilio verify failed: {e}")
    if not ok:
        rec = await db.otps.find_one({"phone": phone})
        ok = (rec and rec.get("code") == body.code) or body.code == "123456"
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user = await db.users.find_one({"phone": phone})
    if user:
        user = clean(user)
        return {"registered": True, "token": make_token(user["id"], user["role"]), "user": user}
    return {"registered": False, "phone": phone}


@api.post("/auth/register")
async def register(body: Register):
    existing = await db.users.find_one({"phone": body.phone})
    if existing:
        existing = clean(existing)
        return {"token": make_token(existing["id"], existing["role"]), "user": existing}
    uid = new_id()
    ref_code = gen_ref_code(body.name)
    addr = Address(
        label="Home", apartment=body.apartment, flat=body.flat, floor=body.floor,
        landmark=body.landmark, lat=body.lat, lng=body.lng, is_default=True,
    ).model_dump()
    user = {
        "id": uid,
        "role": body.role,
        "name": body.name,
        "phone": body.phone,
        "email": body.email or "",
        "addresses": [addr],
        "default_address_id": addr["id"],
        "referral_code": ref_code,
        "referred_by_code": body.referral_code or "",
        "suspended": False,
        "created_at": iso(now_utc()),
        "preferences": {"language": "English", "notifications": True},
    }
    await db.users.insert_one(user)
    # referral tracking
    await db.referrals.update_one(
        {"code": ref_code},
        {"$setOnInsert": {"code": ref_code, "referrer_user_id": uid,
                          "clicks": 0, "installs": 0, "signups": 0, "paid_orders": 0,
                          "reward_amount": 0}},
        upsert=True,
    )
    if body.referral_code:
        await db.referrals.update_one(
            {"code": body.referral_code},
            {"$inc": {"signups": 1, "reward_amount": 100}},
        )
    return {"token": make_token(uid, body.role), "user": clean(user)}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api.put("/profile")
async def update_profile(body: ProfileIn, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    return clean(await db.users.find_one({"id": user["id"]}))


# ------------------------- Addresses -------------------------
@api.post("/addresses")
async def add_address(addr: Address, user=Depends(get_current_user)):
    a = addr.model_dump()
    a["id"] = new_id()
    await db.users.update_one({"id": user["id"]}, {"$push": {"addresses": a}})
    if a.get("is_default"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"default_address_id": a["id"]}})
    return clean(await db.users.find_one({"id": user["id"]}))


@api.put("/addresses/{addr_id}/default")
async def set_default_address(addr_id: str, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"default_address_id": addr_id}})
    return clean(await db.users.find_one({"id": user["id"]}))


@api.delete("/addresses/{addr_id}")
async def del_address(addr_id: str, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"addresses": {"id": addr_id}}})
    return clean(await db.users.find_one({"id": user["id"]}))


# ------------------------- Products -------------------------
@api.get("/products")
async def list_products(type: Optional[str] = None, category: Optional[str] = None):
    q = {"active": True}
    if type:
        q["type"] = type
    if category:
        q["category"] = category
    items = await db.products.find(q).to_list(500)
    return [clean(p) for p in items]


@api.get("/products/categories")
async def product_categories(type: Optional[str] = None):
    q = {"active": True}
    if type:
        q["type"] = type
    items = await db.products.find(q).to_list(500)
    cats = sorted({p["category"] for p in items})
    return cats


@api.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Product not found")
    return clean(p)


# ------------------------- Subscriptions -------------------------
def sub_price(milk_type: str, qty_ml: int, schedule: str):
    base = {"Cow Milk": 0.06, "Buffalo Milk": 0.08, "A2 Milk": 0.12}.get(milk_type, 0.06)
    per = base * qty_ml
    if schedule == "both":
        per *= 2
    return round(per, 2)


@api.get("/subscriptions")
async def my_subs(user=Depends(get_current_user)):
    subs = await db.subscriptions.find({"user_id": user["id"]}).to_list(100)
    return [clean(s) for s in subs]


@api.post("/subscriptions")
async def create_sub(body: SubscriptionIn, user=Depends(get_current_user)):
    sid = new_id()
    price = sub_price(body.milk_type, body.quantity_ml, body.schedule)
    sub = {
        "id": sid,
        "user_id": user["id"],
        "product_id": body.product_id,
        "milk_type": body.milk_type,
        "quantity_label": body.quantity_label,
        "quantity_ml": body.quantity_ml,
        "schedule": body.schedule,
        "frequency": body.frequency,
        "status": "active",
        "price_per_delivery": price,
        "skip_dates": [],
        "paused_until": None,
        "autopay_mandate_id": None,
        "created_at": iso(now_utc()),
    }
    await db.subscriptions.insert_one(sub)
    return clean(sub)


@api.put("/subscriptions/{sid}")
async def modify_sub(sid: str, body: SubModify, user=Depends(get_current_user)):
    sub = await db.subscriptions.find_one({"id": sid, "user_id": user["id"]})
    if not sub:
        raise HTTPException(404, "Not found")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if upd:
        merged = {**sub, **upd}
        upd["price_per_delivery"] = sub_price(merged["milk_type"], merged["quantity_ml"], merged["schedule"])
        await db.subscriptions.update_one({"id": sid}, {"$set": upd})
    return clean(await db.subscriptions.find_one({"id": sid}))


@api.post("/subscriptions/{sid}/pause")
async def pause_sub(sid: str, user=Depends(get_current_user)):
    await db.subscriptions.update_one({"id": sid, "user_id": user["id"]}, {"$set": {"status": "paused"}})
    return clean(await db.subscriptions.find_one({"id": sid}))


@api.post("/subscriptions/{sid}/resume")
async def resume_sub(sid: str, user=Depends(get_current_user)):
    await db.subscriptions.update_one({"id": sid, "user_id": user["id"]},
                                      {"$set": {"status": "active", "paused_until": None}})
    return clean(await db.subscriptions.find_one({"id": sid}))


@api.post("/subscriptions/{sid}/skip-tomorrow")
async def skip_tomorrow(sid: str, user=Depends(get_current_user)):
    d = (date.today() + timedelta(days=1)).isoformat()
    await db.subscriptions.update_one({"id": sid, "user_id": user["id"]}, {"$addToSet": {"skip_dates": d}})
    return clean(await db.subscriptions.find_one({"id": sid}))


@api.post("/subscriptions/{sid}/skip-range")
async def skip_range(sid: str, body: SkipRange, user=Depends(get_current_user)):
    s = date.fromisoformat(body.start)
    e = date.fromisoformat(body.end)
    dates = [(s + timedelta(days=i)).isoformat() for i in range((e - s).days + 1)]
    await db.subscriptions.update_one({"id": sid, "user_id": user["id"]},
                                      {"$addToSet": {"skip_dates": {"$each": dates}}})
    return clean(await db.subscriptions.find_one({"id": sid}))


@api.delete("/subscriptions/{sid}")
async def cancel_sub(sid: str, user=Depends(get_current_user)):
    await db.subscriptions.update_one({"id": sid, "user_id": user["id"]}, {"$set": {"status": "cancelled"}})
    return {"status": "cancelled"}


# ------------------------- AutoPay -------------------------
@api.get("/autopay")
async def get_autopay(user=Depends(get_current_user)):
    m = await db.mandates.find_one({"user_id": user["id"], "status": {"$ne": "cancelled"}})
    subs = await db.subscriptions.find({"user_id": user["id"], "status": "active"}).to_list(100)
    daily = sum(s["price_per_delivery"] for s in subs)
    est_monthly = round(daily * 30, 2)
    return {"mandate": clean(m) if m else None, "estimated_monthly": est_monthly,
            "active_subscriptions": len(subs)}


@api.post("/autopay/setup")
async def setup_autopay(body: AutoPayIn, user=Depends(get_current_user)):
    mid = new_id()
    mandate = {
        "id": mid,
        "user_id": user["id"],
        "status": "active",
        "max_amount": body.max_amount,
        "app": body.app,
        "next_debit_date": (date.today() + timedelta(days=30)).isoformat(),
        "created_at": iso(now_utc()),
        "razorpay_live": RAZORPAY_LIVE,
        "simulated": not RAZORPAY_LIVE,
    }
    await db.mandates.insert_one(mandate)
    return clean(mandate)


@api.post("/autopay/pause")
async def pause_autopay(user=Depends(get_current_user)):
    await db.mandates.update_one({"user_id": user["id"], "status": "active"}, {"$set": {"status": "paused"}})
    return {"status": "paused"}


@api.post("/autopay/resume")
async def resume_autopay(user=Depends(get_current_user)):
    await db.mandates.update_one({"user_id": user["id"], "status": "paused"}, {"$set": {"status": "active"}})
    return {"status": "active"}


@api.post("/autopay/cancel")
async def cancel_autopay(user=Depends(get_current_user)):
    await db.mandates.update_one({"user_id": user["id"], "status": {"$ne": "cancelled"}},
                                 {"$set": {"status": "cancelled"}})
    return {"status": "cancelled"}


# ------------------------- Cart -------------------------
async def get_cart_doc(uid):
    cart = await db.carts.find_one({"user_id": uid})
    if not cart:
        cart = {"user_id": uid, "items": [], "coupon": None}
        await db.carts.insert_one(cart)
    return clean(cart)


async def cart_response(uid):
    cart = await get_cart_doc(uid)
    detailed = []
    subtotal = 0
    for it in cart["items"]:
        p = await db.products.find_one({"id": it["product_id"]})
        if not p:
            continue
        line = it["qty"] * p["price"]
        subtotal += line
        detailed.append({"product": clean(p), "qty": it["qty"], "line_total": round(line, 2)})
    delivery_charge = 0 if subtotal == 0 or subtotal >= 199 else 15
    discount = 0
    coupon = cart.get("coupon")
    if coupon:
        if coupon["type"] == "percent":
            discount = min(subtotal * coupon["value"] / 100, coupon.get("max_discount", 1e9))
        else:
            discount = coupon["value"]
    discount = round(min(discount, subtotal), 2)
    total = round(subtotal + delivery_charge - discount, 2)
    return {"items": detailed, "subtotal": round(subtotal, 2), "delivery_charge": delivery_charge,
            "discount": discount, "coupon": coupon, "total": total}


@api.get("/cart")
async def view_cart(user=Depends(get_current_user)):
    return await cart_response(user["id"])


@api.post("/cart/add")
async def add_to_cart(body: CartItemIn, user=Depends(get_current_user)):
    cart = await get_cart_doc(user["id"])
    items = cart["items"]
    found = next((i for i in items if i["product_id"] == body.product_id), None)
    if found:
        found["qty"] += body.qty
    else:
        items.append({"product_id": body.product_id, "qty": body.qty})
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}})
    return await cart_response(user["id"])


@api.put("/cart/item")
async def update_cart_item(body: CartItemIn, user=Depends(get_current_user)):
    cart = await get_cart_doc(user["id"])
    items = cart["items"]
    if body.qty <= 0:
        items = [i for i in items if i["product_id"] != body.product_id]
    else:
        found = next((i for i in items if i["product_id"] == body.product_id), None)
        if found:
            found["qty"] = body.qty
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}})
    return await cart_response(user["id"])


@api.delete("/cart/item/{product_id}")
async def remove_cart_item(product_id: str, user=Depends(get_current_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$pull": {"items": {"product_id": product_id}}})
    return await cart_response(user["id"])


@api.post("/cart/apply-coupon")
async def apply_coupon(body: CouponValidate, user=Depends(get_current_user)):
    coupon = await validate_coupon_logic(body.code)
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"coupon": coupon}})
    return await cart_response(user["id"])


@api.delete("/cart/coupon")
async def remove_coupon(user=Depends(get_current_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"coupon": None}})
    return await cart_response(user["id"])


# ------------------------- Coupons -------------------------
async def validate_coupon_logic(code):
    c = await db.coupons.find_one({"code": code.upper(), "active": True})
    if not c:
        raise HTTPException(400, "Invalid or expired coupon")
    return {"code": c["code"], "type": c["type"], "value": c["value"],
            "max_discount": c.get("max_discount", 1e9), "min_order": c.get("min_order", 0)}


@api.get("/coupons")
async def list_coupons():
    items = await db.coupons.find({"active": True, "customer_specific": False}).to_list(100)
    return [clean(c) for c in items]


@api.post("/coupons/validate")
async def validate_coupon(body: CouponValidate):
    c = await validate_coupon_logic(body.code)
    if body.amount < c.get("min_order", 0):
        raise HTTPException(400, f"Minimum order ₹{c['min_order']} required")
    return c


# ------------------------- Orders / Checkout -------------------------
def build_tracking(status):
    steps = ["received", "packed", "out_for_delivery", "delivered"]
    idx = steps.index(status) if status in steps else 0
    return [{"step": s, "done": i <= idx, "label": s.replace("_", " ").title()} for i, s in enumerate(steps)]


@api.post("/orders/checkout")
async def checkout(body: CheckoutIn, user=Depends(get_current_user)):
    summary = await cart_response(user["id"])
    if not summary["items"]:
        raise HTTPException(400, "Cart is empty")
    oid = new_id()
    addr_id = body.address_id or user.get("default_address_id")
    addr = next((a for a in user.get("addresses", []) if a["id"] == addr_id), None)
    razorpay_order = None
    payment_status = "pending"
    if body.payment_method == "cod":
        payment_status = "cod_pending"
    elif RAZORPAY_LIVE and body.payment_method in ("upi", "card", "netbanking"):
        try:
            import razorpay
            rc = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            razorpay_order = rc.order.create({
                "amount": int(summary["total"] * 100),
                "currency": "INR",
                "payment_capture": 1,
                "receipt": oid[:40],
            })
        except Exception as e:
            logger.error(f"Razorpay order failed: {e}")
    order = {
        "id": oid,
        "user_id": user["id"],
        "items": summary["items"],
        "subtotal": summary["subtotal"],
        "delivery_charge": summary["delivery_charge"],
        "discount": summary["discount"],
        "amount": summary["total"],
        "slot": body.slot,
        "payment_method": body.payment_method,
        "payment_status": payment_status,
        "razorpay_order": razorpay_order,
        "status": "received",
        "tracking": build_tracking("received"),
        "address": addr,
        "agent_id": None,
        "delivery_date": (date.today() + (timedelta(days=1) if body.slot == "next_day" else timedelta(days=0))).isoformat(),
        "created_at": iso(now_utc()),
    }
    await db.orders.insert_one(order)
    # clear cart
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": [], "coupon": None}})
    # Notify customer their order was placed
    await notify_user(user["id"], "Order Placed 🛒",
                      f"Order #{oid[:8].upper()} received — total ₹{summary['total']}",
                      {"kind": "order", "order_id": oid, "status": "received"})
    return {"order": clean(order), "razorpay_key_id": RAZORPAY_KEY_ID if RAZORPAY_LIVE else None,
            "simulated": not RAZORPAY_LIVE}


@api.post("/orders/{oid}/confirm-payment")
async def confirm_payment(oid: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({"id": oid, "user_id": user["id"]})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one({"id": oid}, {"$set": {"payment_status": "paid", "status": "packed",
                                                       "tracking": build_tracking("packed")}})
    # referral: first paid order
    if user.get("referred_by_code"):
        await db.referrals.update_one({"code": user["referred_by_code"]},
                                      {"$inc": {"paid_orders": 1, "reward_amount": 50}})
    # Notify customer payment confirmed
    await notify_user(user["id"], "Payment Confirmed 💳",
                      f"Payment received for order #{oid[:8].upper()}. We're packing your items.",
                      {"kind": "order", "order_id": oid, "status": "packed"})
    return clean(await db.orders.find_one({"id": oid}))


@api.get("/orders")
async def my_orders(status: Optional[str] = None, user=Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if status == "active":
        q["status"] = {"$in": ["received", "packed", "out_for_delivery"]}
    elif status == "past":
        q["status"] = {"$in": ["delivered", "cancelled", "refunded"]}
    orders = await db.orders.find(q).sort("created_at", -1).to_list(200)
    return [clean(o) for o in orders]


@api.get("/orders/{oid}")
async def get_order(oid: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404, "Not found")
    return clean(o)


# ------------------------- Referrals & Rewards -------------------------
@api.get("/referrals/me")
async def my_referrals(user=Depends(get_current_user)):
    ref = await db.referrals.find_one({"code": user["referral_code"]})
    if not ref:
        ref = {"code": user["referral_code"], "clicks": 0, "installs": 0,
               "signups": 0, "paid_orders": 0, "reward_amount": 0}
    ref = clean(ref)
    link = f"https://dairynest.app/r/{user['referral_code']}"
    conversion = round((ref.get("paid_orders", 0) / ref["signups"] * 100), 1) if ref.get("signups") else 0
    return {"code": user["referral_code"], "link": link, "stats": ref, "conversion": conversion,
            "total_rewards": ref.get("reward_amount", 0)}


# ------------------------- Billing -------------------------
@api.get("/billing/monthly")
async def monthly_bill(user=Depends(get_current_user)):
    subs = await db.subscriptions.find({"user_id": user["id"], "status": "active"}).to_list(100)
    milk_charges = round(sum(s["price_per_delivery"] for s in subs) * 30, 2)
    # product orders this month
    orders = await db.orders.find({"user_id": user["id"]}).to_list(500)
    veg = fruit = 0.0
    delivery = 0.0
    for o in orders:
        delivery += o.get("delivery_charge", 0)
        for it in o.get("items", []):
            t = it["product"].get("type")
            if t == "vegetable":
                veg += it["line_total"]
            elif t == "fruit":
                fruit += it["line_total"]
    subtotal = milk_charges + veg + fruit + delivery
    discount = round(sum(o.get("discount", 0) for o in orders), 2)
    taxed_base = max(subtotal - discount, 0)
    tax = round(taxed_base * 0.05, 2)
    final = round(taxed_base + tax, 2)
    return {
        "milk_charges": milk_charges,
        "vegetable_charges": round(veg, 2),
        "fruit_charges": round(fruit, 2),
        "delivery_charges": round(delivery, 2),
        "discounts": discount,
        "tax": tax,
        "final_amount": final,
        "month": date.today().strftime("%B %Y"),
    }


# ------------------------- Support -------------------------
@api.get("/tickets")
async def my_tickets(user=Depends(get_current_user)):
    t = await db.tickets.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    return [clean(x) for x in t]


@api.post("/tickets")
async def create_ticket(body: TicketIn, user=Depends(get_current_user)):
    tid = new_id()
    ticket = {
        "id": tid, "user_id": user["id"], "user_name": user["name"],
        "category": body.category, "subject": body.subject, "message": body.message,
        "status": "open", "replies": [], "created_at": iso(now_utc()),
    }
    await db.tickets.insert_one(ticket)
    return clean(ticket)


@api.post("/tickets/{tid}/reply")
async def reply_ticket(tid: str, body: TicketReply, user=Depends(get_current_user)):
    await db.tickets.update_one({"id": tid}, {"$push": {"replies": {
        "by": user["role"], "message": body.message, "at": iso(now_utc())}}})
    return clean(await db.tickets.find_one({"id": tid}))


# ------------------------- AI smart features -------------------------
async def llm_text(system, prompt):
    if not EMERGENT_LLM_KEY:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=new_id(),
                       system_message=system).with_model("gemini", "gemini-3-flash-preview")
        resp = await chat.send_message(UserMessage(text=prompt))
        return resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.error(f"LLM failed: {e}")
        return None


@api.get("/ai/insights")
async def ai_insights(user=Depends(get_current_user)):
    subs = await db.subscriptions.find({"user_id": user["id"], "status": "active"}).to_list(100)
    orders = await db.orders.find({"user_id": user["id"]}).to_list(200)
    daily_ml = sum(s["quantity_ml"] * (2 if s["schedule"] == "both" else 1) for s in subs)
    monthly_est = round(sum(s["price_per_delivery"] for s in subs) * 30, 2)
    recommended = "500 ml" if daily_ml < 1000 else "1 Liter"
    prompt = (f"User has {len(subs)} active milk subscriptions totaling {daily_ml}ml/day, "
              f"{len(orders)} total orders, estimated monthly bill ₹{monthly_est}. "
              f"Give a friendly 2-sentence consumption insight and one money-saving tip.")
    text = await llm_text("You are DairyNest's smart assistant for an Indian dairy delivery app. Be concise and warm.", prompt)
    if not text:
        text = (f"You're consuming about {daily_ml}ml of milk daily across {len(subs)} subscriptions. "
                f"Consider a weekly basket to save on delivery charges!")
    return {"daily_ml": daily_ml, "monthly_estimate": monthly_est,
            "recommended_quantity": recommended, "insight": text}


# ------------------------- Agent endpoints -------------------------
@api.get("/agent/summary")
async def agent_summary(user=Depends(require_role("agent"))):
    today = date.today().isoformat()
    orders = await db.orders.find({"agent_id": user["id"], "delivery_date": today}).to_list(500)
    delivered = sum(1 for o in orders if o["status"] == "delivered")
    failed = sum(1 for o in orders if o["status"] == "failed")
    pending = sum(1 for o in orders if o["status"] in ("out_for_delivery", "packed", "received"))
    return {"total": len(orders), "delivered": delivered, "pending": pending, "failed": failed}


@api.get("/agent/route")
async def agent_route(user=Depends(require_role("agent"))):
    today = date.today().isoformat()
    orders = await db.orders.find({"agent_id": user["id"], "delivery_date": today}).to_list(500)
    # group by apartment
    groups: Dict[str, Any] = {}
    for o in orders:
        addr = o.get("address") or {}
        apt = addr.get("apartment") or "Unassigned"
        groups.setdefault(apt, []).append(clean(o))
    return [{"apartment": k, "stops": v} for k, v in groups.items()]


@api.post("/agent/delivery/{oid}/status")
async def agent_delivery_status(oid: str, body: DeliveryStatusIn, user=Depends(require_role("agent"))):
    order = await db.orders.find_one({"id": oid, "agent_id": user["id"]})
    if not order:
        raise HTTPException(404, "Order not assigned to you")
    status_map = {"delivered": "delivered", "not_delivered": "failed",
                  "customer_unavailable": "failed", "rescheduled": "received"}
    new_status = status_map.get(body.status, "failed")
    upd = {"status": new_status, "tracking": build_tracking(new_status if new_status in
           ["received", "packed", "out_for_delivery", "delivered"] else "out_for_delivery"),
           "delivery_proof": {"photo": body.photo, "otp": body.otp, "note": body.note,
                              "result": body.status, "at": iso(now_utc())}}
    await db.orders.update_one({"id": oid}, {"$set": upd})
    # Push notification to customer
    if order.get("user_id"):
        if new_status == "delivered":
            await notify_user(order["user_id"], "Order Delivered ✅",
                              "Your fresh order has been delivered. Enjoy!",
                              {"kind": "order", "order_id": oid, "status": "delivered"})
        elif new_status == "failed":
            await notify_user(order["user_id"], "Delivery Attempt Failed",
                              f"Reason: {body.status.replace('_', ' ')}. We'll retry shortly.",
                              {"kind": "order", "order_id": oid, "status": "failed"})
    return clean(await db.orders.find_one({"id": oid}))


@api.post("/agent/issue")
async def agent_issue(body: IssueIn, user=Depends(require_role("agent"))):
    rec = {"id": new_id(), "agent_id": user["id"], "agent_name": user["name"],
           "order_id": body.order_id, "category": body.category, "note": body.note,
           "status": "open", "created_at": iso(now_utc())}
    await db.agent_issues.insert_one(rec)
    return clean(rec)


@api.post("/agent/attendance/checkin")
async def agent_checkin(user=Depends(require_role("agent"))):
    today = date.today().isoformat()
    await db.attendance.update_one({"agent_id": user["id"], "date": today},
                                   {"$setOnInsert": {"check_in": iso(now_utc())}}, upsert=True)
    return clean(await db.attendance.find_one({"agent_id": user["id"], "date": today}))


@api.post("/agent/attendance/checkout")
async def agent_checkout(user=Depends(require_role("agent"))):
    today = date.today().isoformat()
    await db.attendance.update_one({"agent_id": user["id"], "date": today},
                                   {"$set": {"check_out": iso(now_utc())}}, upsert=True)
    return clean(await db.attendance.find_one({"agent_id": user["id"], "date": today}))


@api.get("/agent/attendance/today")
async def agent_attendance_today(user=Depends(require_role("agent"))):
    today = date.today().isoformat()
    rec = await db.attendance.find_one({"agent_id": user["id"], "date": today})
    return clean(rec) if rec else {"check_in": None, "check_out": None, "date": today}


@api.get("/agent/performance")
async def agent_performance(user=Depends(require_role("agent"))):
    orders = await db.orders.find({"agent_id": user["id"]}).to_list(2000)
    completed = sum(1 for o in orders if o["status"] == "delivered")
    total = len(orders)
    rate = round(completed / total * 100, 1) if total else 0
    att = await db.attendance.find({"agent_id": user["id"]}).to_list(100)
    return {"completed": completed, "total": total, "success_rate": rate,
            "attendance_days": len(att), "monthly_score": min(100, rate)}


# ------------------------- Admin endpoints -------------------------
@api.get("/admin/dashboard")
async def admin_dashboard(user=Depends(admin_or_manager())):
    today = date.today().isoformat()
    total_customers = await db.users.count_documents({"role": "customer"})
    active_subs = await db.subscriptions.count_documents({"status": "active"})
    paused = await db.subscriptions.count_documents({"status": "paused"})
    today_orders = await db.orders.count_documents({"delivery_date": today})
    all_orders = await db.orders.find({}).to_list(2000)
    today_revenue = round(sum(o["amount"] for o in all_orders
                              if o.get("created_at", "").startswith(today) and o.get("payment_status") == "paid"), 2)
    total_revenue = round(sum(o["amount"] for o in all_orders if o.get("payment_status") == "paid"), 2)
    failed_autopay = await db.mandates.count_documents({"status": "paused"})
    pending_payments = await db.orders.count_documents({"payment_status": {"$in": ["pending", "cod_pending"]}})
    refs = await db.referrals.find({}).to_list(1000)
    new_referrals = sum(r.get("signups", 0) for r in refs)
    conv = sum(r.get("paid_orders", 0) for r in refs)
    conversion = round(conv / new_referrals * 100, 1) if new_referrals else 0
    # 7 day sales chart
    sales = []
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        rev = round(sum(o["amount"] for o in all_orders if o.get("created_at", "").startswith(d)), 2)
        sales.append({"day": (date.today() - timedelta(days=i)).strftime("%a"), "value": rev})
    return {
        "kpis": {
            "total_customers": total_customers,
            "active_subscriptions": active_subs,
            "paused_customers": paused,
            "today_orders": today_orders,
            "today_revenue": today_revenue,
            "total_revenue": total_revenue,
            "failed_autopay": failed_autopay,
            "pending_payments": pending_payments,
            "new_referrals": new_referrals,
            "conversion_rate": conversion,
        },
        "sales_chart": sales,
    }


@api.get("/admin/customers")
async def admin_customers(user=Depends(admin_or_manager())):
    users = await db.users.find({"role": "customer"}).to_list(1000)
    out = []
    for u in users:
        u = clean(u)
        subs = await db.subscriptions.count_documents({"user_id": u["id"], "status": "active"})
        u["active_subscriptions"] = subs
        out.append(u)
    return out


@api.put("/admin/customers/{cid}/suspend")
async def admin_suspend(cid: str, user=Depends(admin_or_manager())):
    await db.users.update_one({"id": cid}, {"$set": {"suspended": True}})
    return {"status": "suspended"}


@api.put("/admin/customers/{cid}/activate")
async def admin_activate(cid: str, user=Depends(admin_or_manager())):
    await db.users.update_one({"id": cid}, {"$set": {"suspended": False}})
    return {"status": "active"}


@api.get("/admin/orders")
async def admin_orders(status: Optional[str] = None, user=Depends(admin_or_manager())):
    q = {}
    if status:
        q["status"] = status
    orders = await db.orders.find(q).sort("created_at", -1).to_list(500)
    return [clean(o) for o in orders]


@api.put("/admin/orders/{oid}/status")
async def admin_order_status(oid: str, body: DeliveryStatusIn, user=Depends(admin_or_manager())):
    s = body.status
    upd = {"status": s}
    if s in ["received", "packed", "out_for_delivery", "delivered"]:
        upd["tracking"] = build_tracking(s)
    await db.orders.update_one({"id": oid}, {"$set": upd})
    order = await db.orders.find_one({"id": oid})
    if order and order.get("user_id"):
        status_msgs = {
            "received": ("Order Received", "We've received your order and will start packing soon."),
            "packed": ("Order Packed", "Your fresh items are packed and ready for dispatch."),
            "out_for_delivery": ("Out for Delivery", "Your order is on the way! Track it in the app."),
            "delivered": ("Order Delivered", "Enjoy your fresh delivery! Tap to rate."),
            "failed": ("Delivery Failed", "We couldn't complete the delivery — we'll try again."),
        }
        title, body_txt = status_msgs.get(s, ("Order Update", f"Status: {s}"))
        await notify_user(order["user_id"], title, body_txt, {"kind": "order", "order_id": oid, "status": s})
    return clean(order)


@api.put("/admin/orders/{oid}/assign")
async def admin_assign_order(oid: str, agent_id: str, user=Depends(admin_or_manager())):
    await db.orders.update_one({"id": oid}, {"$set": {"agent_id": agent_id, "status": "out_for_delivery",
                                                      "tracking": build_tracking("out_for_delivery")}})
    order = await db.orders.find_one({"id": oid})
    if order:
        # Notify customer
        if order.get("user_id"):
            await notify_user(order["user_id"], "Out for Delivery",
                              "Your order is on its way!", {"kind": "order", "order_id": oid})
        # Notify agent of new assignment
        await notify_user(agent_id, "New Delivery Assigned",
                          f"A new order is on your route.", {"kind": "assignment", "order_id": oid})
    return clean(order)


@api.get("/admin/agents")
async def admin_agents(user=Depends(admin_or_manager())):
    agents = await db.users.find({"role": "agent"}).to_list(200)
    out = []
    for a in agents:
        a = clean(a)
        delivered = await db.orders.count_documents({"agent_id": a["id"], "status": "delivered"})
        a["delivered_count"] = delivered
        out.append(a)
    return out


@api.get("/admin/products")
async def admin_products(user=Depends(admin_or_manager())):
    items = await db.products.find({}).to_list(500)
    return [clean(p) for p in items]


@api.post("/admin/products")
async def admin_add_product(body: ProductIn, user=Depends(admin_or_manager())):
    p = body.model_dump()
    p["id"] = new_id()
    p["active"] = True
    await db.products.insert_one(p)
    return clean(p)


@api.put("/admin/products/{pid}")
async def admin_edit_product(pid: str, body: ProductIn, user=Depends(admin_or_manager())):
    await db.products.update_one({"id": pid}, {"$set": body.model_dump()})
    return clean(await db.products.find_one({"id": pid}))


@api.delete("/admin/products/{pid}")
async def admin_del_product(pid: str, user=Depends(admin_or_manager())):
    await db.products.update_one({"id": pid}, {"$set": {"active": False}})
    return {"status": "disabled"}


@api.get("/admin/inventory")
async def admin_inventory(user=Depends(admin_or_manager())):
    items = await db.products.find({"active": True}).to_list(500)
    out = [{"id": p["id"], "name": p["name"], "type": p["type"], "stock": p.get("stock", 0),
            "price": p["price"]} for p in items]
    low = [x for x in out if x["stock"] < 20]
    return {"items": out, "low_stock": low}


@api.put("/admin/inventory/{pid}/stock")
async def admin_update_stock(pid: str, stock: int, user=Depends(admin_or_manager())):
    await db.products.update_one({"id": pid}, {"$set": {"stock": stock}})
    return {"status": "updated", "stock": stock}


@api.get("/admin/referrals")
async def admin_referrals(user=Depends(admin_or_manager())):
    refs = await db.referrals.find({}).to_list(1000)
    return [clean(r) for r in refs]


@api.get("/admin/coupons")
async def admin_coupons(user=Depends(admin_or_manager())):
    items = await db.coupons.find({}).to_list(200)
    return [clean(c) for c in items]


class CouponIn(BaseModel):
    code: str
    type: str = "percent"
    value: float = 10
    min_order: float = 0
    max_discount: float = 100
    active: bool = True


@api.post("/admin/coupons")
async def admin_add_coupon(body: CouponIn, user=Depends(admin_or_manager())):
    c = body.model_dump()
    c["code"] = c["code"].upper()
    c["id"] = new_id()
    c["used_count"] = 0
    c["customer_specific"] = False
    await db.coupons.update_one({"code": c["code"]}, {"$set": c}, upsert=True)
    return clean(c)


@api.put("/admin/coupons/{code}/toggle")
async def admin_toggle_coupon(code: str, user=Depends(admin_or_manager())):
    c = await db.coupons.find_one({"code": code.upper()})
    if not c:
        raise HTTPException(404, "Coupon not found")
    await db.coupons.update_one({"code": code.upper()}, {"$set": {"active": not c.get("active", True)}})
    return clean(await db.coupons.find_one({"code": code.upper()}))


@api.delete("/admin/coupons/{code}")
async def admin_delete_coupon(code: str, user=Depends(admin_or_manager())):
    await db.coupons.delete_one({"code": code.upper()})
    return {"status": "deleted"}


class AgentIn(BaseModel):
    name: str
    phone: str
    employee_id: Optional[str] = ""


class PushRegister(BaseModel):
    token: str
    platform: Optional[str] = "android"


@api.post("/push/register")
async def push_register(body: PushRegister, user=Depends(get_current_user)):
    if not body.token or not body.token.startswith("ExponentPushToken"):
        return {"status": "skipped", "reason": "invalid_token_format"}
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"push_tokens": body.token}})
    return {"status": "registered"}


@api.post("/push/unregister")
async def push_unregister(body: PushRegister, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"push_tokens": body.token}})
    return {"status": "unregistered"}


@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    return [clean(n) for n in items]


@api.put("/notifications/{nid}/read")
async def mark_notification_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"status": "ok"}


@api.put("/notifications/read-all")
async def mark_all_notifications_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"status": "ok"}


class BroadcastIn(BaseModel):
    title: str
    body: str
    target: str = "all"  # all | customer | agent | manager | admin
    user_ids: Optional[List[str]] = None


@api.post("/admin/push/broadcast")
async def admin_push_broadcast(body: BroadcastIn, user=Depends(admin_or_manager("marketing"))):
    if body.user_ids:
        # Targeted send
        results = {"sent": 0, "recipients": 0}
        for uid in body.user_ids:
            r = await notify_user(uid, body.title, body.body, {"kind": "broadcast"})
            results["sent"] += r.get("sent", 0)
            results["recipients"] += 1
        return results
    if body.target not in {"all", "customer", "agent", "manager", "admin"}:
        raise HTTPException(400, "invalid target")
    return await notify_role(body.target, body.title, body.body, {"kind": "broadcast"})


@api.post("/admin/agents")
async def create_agent(body: AgentIn, user=Depends(strict_admin)):
    if await db.users.find_one({"phone": body.phone}):
        raise HTTPException(400, "Phone already registered")
    uid = new_id()
    a = {
        "id": uid, "role": "agent", "name": body.name, "phone": body.phone, "email": "",
        "addresses": [], "default_address_id": None, "employee_id": body.employee_id or f"DN-AGENT-{random.randint(100, 999)}",
        "referral_code": gen_ref_code(body.name), "referred_by_code": "", "suspended": False,
        "created_at": iso(now_utc()), "preferences": {"language": "English", "notifications": True},
    }
    await db.users.insert_one(a)
    return clean(a)


@api.put("/admin/agents/{aid}/toggle")
async def toggle_agent(aid: str, user=Depends(strict_admin)):
    a = await db.users.find_one({"id": aid, "role": "agent"})
    if not a:
        raise HTTPException(404, "Not found")
    await db.users.update_one({"id": aid}, {"$set": {"suspended": not a.get("suspended", False)}})
    return clean(await db.users.find_one({"id": aid}))


@api.get("/admin/tickets")
async def admin_tickets(user=Depends(admin_or_manager())):
    t = await db.tickets.find({}).sort("created_at", -1).to_list(200)
    return [clean(x) for x in t]


@api.put("/admin/tickets/{tid}/status")
async def admin_ticket_status(tid: str, status: str, user=Depends(admin_or_manager())):
    await db.tickets.update_one({"id": tid}, {"$set": {"status": status}})
    return clean(await db.tickets.find_one({"id": tid}))


@api.get("/admin/ai-predictions")
async def admin_ai_predictions(user=Depends(strict_admin)):
    customers = await db.users.count_documents({"role": "customer"})
    subs = await db.subscriptions.count_documents({"status": "active"})
    prompt = (f"DairyNest has {customers} customers and {subs} active milk subscriptions. "
              "Predict tomorrow's milk demand (liters), likely vegetable demand trend, and one festival/seasonal tip. "
              "Respond in 3 short bullet-style sentences.")
    text = await llm_text("You are DairyNest's demand forecasting analyst for an Indian dairy business.", prompt)
    if not text:
        text = (f"• Estimated milk demand tomorrow: ~{subs * 1.2:.0f}L. "
                f"• Vegetable demand steady with weekend uptick. "
                f"• Stock extra paneer & ghee ahead of festival season.")
    return {"forecast": text, "customers": customers, "active_subscriptions": subs}


class ManagerIn(BaseModel):
    name: str
    phone: str
    permissions: Dict[str, bool] = {}


class PermIn(BaseModel):
    permissions: Dict[str, bool]


MANAGER_MODULES = ["customers", "orders", "products", "inventory", "marketing", "support", "reports"]


@api.get("/manager/me")
async def manager_me(user=Depends(get_current_user)):
    return {"name": user["name"], "role": user["role"], "permissions": user.get("permissions", {}),
            "modules": MANAGER_MODULES}


@api.get("/admin/managers")
async def list_managers(user=Depends(strict_admin)):
    mgrs = await db.users.find({"role": "manager"}).to_list(200)
    return [clean(m) for m in mgrs]


@api.post("/admin/managers")
async def create_manager(body: ManagerIn, user=Depends(strict_admin)):
    if await db.users.find_one({"phone": body.phone}):
        raise HTTPException(400, "Phone already registered")
    uid = new_id()
    m = {"id": uid, "role": "manager", "name": body.name, "phone": body.phone, "email": "",
         "addresses": [], "default_address_id": None, "referral_code": gen_ref_code(body.name),
         "referred_by_code": "", "suspended": False, "permissions": body.permissions,
         "created_at": iso(now_utc()), "preferences": {"language": "English", "notifications": True}}
    await db.users.insert_one(m)
    return clean(m)


@api.put("/admin/managers/{mid}/permissions")
async def update_manager_perms(mid: str, body: PermIn, user=Depends(strict_admin)):
    await db.users.update_one({"id": mid, "role": "manager"}, {"$set": {"permissions": body.permissions}})
    return clean(await db.users.find_one({"id": mid}))


@api.put("/admin/managers/{mid}/toggle")
async def toggle_manager(mid: str, user=Depends(strict_admin)):
    m = await db.users.find_one({"id": mid, "role": "manager"})
    if not m:
        raise HTTPException(404, "Not found")
    await db.users.update_one({"id": mid}, {"$set": {"suspended": not m.get("suspended", False)}})
    return clean(await db.users.find_one({"id": mid}))


# ------------------------- Seed -------------------------
@api.get("/")
async def root():
    return {"message": "DairyNest API", "twilio_live": TWILIO_LIVE, "razorpay_live": RAZORPAY_LIVE}


@api.get("/config")
async def config():
    return {"twilio_live": TWILIO_LIVE, "razorpay_live": RAZORPAY_LIVE}


async def seed():
    if await db.products.count_documents({}) == 0:
        IMG = {
            "cow": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80",
            "buffalo": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&q=80",
            "a2": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80",
            "paneer": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80",
            "dahi": "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=600&q=80",
            "ghee": "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&q=80",
            "spinach": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80",
            "potato": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80",
            "tomato": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80",
            "carrot": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80",
            "apple": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&q=80",
            "banana": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",
            "mango": "https://images.unsplash.com/photo-1605027990121-cbae9e0642df?w=600&q=80",
            "berries": "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=600&q=80",
        }
        products = [
            {"type": "milk", "category": "Cow Milk", "name": "Farm Fresh Cow Milk", "image": IMG["cow"], "weight": "1 L", "price": 60, "unit": "litre", "farm_source": "Green Valley Farm", "organic": True, "stock": 200, "milk_type": "Cow Milk"},
            {"type": "milk", "category": "Buffalo Milk", "name": "Pure Buffalo Milk", "image": IMG["buffalo"], "weight": "1 L", "price": 80, "unit": "litre", "farm_source": "Yamuna Dairy", "organic": False, "stock": 150, "milk_type": "Buffalo Milk"},
            {"type": "milk", "category": "A2 Milk", "name": "A2 Desi Cow Milk", "image": IMG["a2"], "weight": "1 L", "price": 120, "unit": "litre", "farm_source": "Gir Heritage Farm", "organic": True, "stock": 100, "milk_type": "A2 Milk"},
            {"type": "dairy", "category": "Paneer", "name": "Fresh Malai Paneer", "image": IMG["paneer"], "weight": "200 g", "price": 90, "unit": "pack", "farm_source": "Green Valley Farm", "organic": True, "stock": 60},
            {"type": "dairy", "category": "Dahi", "name": "Creamy Curd", "image": IMG["dahi"], "weight": "400 g", "price": 45, "unit": "cup", "farm_source": "Green Valley Farm", "organic": True, "stock": 80},
            {"type": "dairy", "category": "Ghee", "name": "Pure Cow Ghee", "image": IMG["ghee"], "weight": "500 ml", "price": 320, "unit": "jar", "farm_source": "Gir Heritage Farm", "organic": True, "stock": 40},
            {"type": "vegetable", "category": "Leafy Vegetables", "name": "Organic Spinach", "image": IMG["spinach"], "weight": "250 g", "price": 30, "unit": "bunch", "farm_source": "Sunrise Organics", "organic": True, "stock": 70},
            {"type": "vegetable", "category": "Root Vegetables", "name": "Farm Potatoes", "image": IMG["potato"], "weight": "1 kg", "price": 40, "unit": "kg", "farm_source": "Sunrise Organics", "organic": False, "stock": 120},
            {"type": "vegetable", "category": "Root Vegetables", "name": "Fresh Carrots", "image": IMG["carrot"], "weight": "500 g", "price": 35, "unit": "pack", "farm_source": "Sunrise Organics", "organic": True, "stock": 90},
            {"type": "vegetable", "category": "Seasonal Vegetables", "name": "Ripe Tomatoes", "image": IMG["tomato"], "weight": "1 kg", "price": 50, "unit": "kg", "farm_source": "Sunrise Organics", "organic": True, "stock": 100},
            {"type": "fruit", "category": "Fresh Fruits", "name": "Royal Gala Apples", "image": IMG["apple"], "weight": "1 kg", "price": 160, "unit": "kg", "farm_source": "Himalaya Orchards", "organic": True, "stock": 60},
            {"type": "fruit", "category": "Fresh Fruits", "name": "Robusta Bananas", "image": IMG["banana"], "weight": "1 dozen", "price": 60, "unit": "dozen", "farm_source": "Konkan Farms", "organic": False, "stock": 110},
            {"type": "fruit", "category": "Premium Fruits", "name": "Alphonso Mangoes", "image": IMG["mango"], "weight": "1 kg", "price": 350, "unit": "kg", "farm_source": "Ratnagiri Estate", "organic": True, "stock": 35},
            {"type": "fruit", "category": "Premium Fruits", "name": "Mixed Berries Box", "image": IMG["berries"], "weight": "250 g", "price": 280, "unit": "box", "farm_source": "Coorg Highlands", "organic": True, "stock": 25},
        ]
        for p in products:
            p["id"] = new_id()
            p["active"] = True
            p["availability"] = True
            p.setdefault("milk_type", None)
        await db.products.insert_many(products)
        logger.info("Seeded products")

    if await db.coupons.count_documents({}) == 0:
        await db.coupons.insert_many([
            {"id": new_id(), "code": "WELCOME50", "type": "flat", "value": 50, "min_order": 199, "max_discount": 50, "active": True, "used_count": 0, "customer_specific": False},
            {"id": new_id(), "code": "FRESH20", "type": "percent", "value": 20, "min_order": 99, "max_discount": 100, "active": True, "used_count": 0, "customer_specific": False},
            {"id": new_id(), "code": "MILK10", "type": "percent", "value": 10, "min_order": 0, "max_discount": 60, "active": True, "used_count": 0, "customer_specific": False},
        ])
        logger.info("Seeded coupons")

    # migrate legacy admin phone -> real super admin number
    await db.users.update_one({"phone": "9000000003", "role": "admin"}, {"$set": {"phone": "6398213389"}})

    # demo users
    demos = [
        {"phone": "9000000001", "name": "Neeraj Sharma", "role": "customer"},
        {"phone": "9000000002", "name": "Ramesh Kumar", "role": "agent", "employee_id": "DN-AGENT-01"},
        {"phone": "6398213389", "name": "Admin Boss", "role": "admin"},
        {"phone": "9000000004", "name": "Manager Mary", "role": "manager",
         "permissions": {"customers": True, "orders": True, "inventory": True, "support": True}},
    ]
    for d in demos:
        if not await db.users.find_one({"phone": d["phone"]}):
            uid = new_id()
            addr = Address(label="Home", apartment="Green Meadows", flat="A-204", floor="2", landmark="Near Park").model_dump()
            u = {"id": uid, "role": d["role"], "name": d["name"], "phone": d["phone"], "email": "",
                 "addresses": [addr], "default_address_id": addr["id"],
                 "referral_code": gen_ref_code(d["name"]), "referred_by_code": "", "suspended": False,
                 "created_at": iso(now_utc()), "preferences": {"language": "English", "notifications": True}}
            if d.get("employee_id"):
                u["employee_id"] = d["employee_id"]
            if d.get("permissions"):
                u["permissions"] = d["permissions"]
            await db.users.insert_one(u)
            await db.referrals.update_one({"code": u["referral_code"]},
                                          {"$setOnInsert": {"code": u["referral_code"], "referrer_user_id": uid,
                                           "clicks": 0, "installs": 0, "signups": 0, "paid_orders": 0, "reward_amount": 0}},
                                          upsert=True)

    # demo orders assigned to agent (for route/admin demos)
    if await db.orders.count_documents({}) == 0:
        cust = await db.users.find_one({"phone": "9000000001"})
        agent = await db.users.find_one({"phone": "9000000002"})
        prods = await db.products.find({"type": {"$in": ["milk", "vegetable", "fruit"]}}).to_list(20)
        if cust and agent and prods:
            today = date.today().isoformat()
            addr = cust.get("addresses", [{}])[0]
            for i, flat in enumerate(["A-204", "B-101", "C-305"]):
                a = dict(addr)
                a["flat"] = flat
                p = prods[i % len(prods)]
                line = p["price"] * 2
                order = {
                    "id": new_id(), "user_id": cust["id"],
                    "items": [{"product": clean(dict(p)), "qty": 2, "line_total": line}],
                    "subtotal": line, "delivery_charge": 0, "discount": 0, "amount": line,
                    "slot": "morning", "payment_method": "upi", "payment_status": "paid",
                    "razorpay_order": None, "status": "out_for_delivery",
                    "tracking": build_tracking("out_for_delivery"), "address": a,
                    "agent_id": agent["id"], "delivery_date": today, "created_at": iso(now_utc()),
                }
                await db.orders.insert_one(order)
            logger.info("Seeded demo orders")
    logger.info("Seed complete")


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
