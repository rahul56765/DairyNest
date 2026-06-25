"""DairyNest API regression tests covering customer, agent, and admin flows."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://readme-guide-9.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER_PHONE = "9000000001"
AGENT_PHONE = "9000000002"
ADMIN_PHONE = "9000000003"
OTP = "123456"


# -------- helpers --------
def _login(phone):
    r = requests.post(f"{API}/auth/send-otp", json={"phone": phone}, timeout=20)
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": OTP}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("registered") is True, f"Expected demo user pre-registered: {data}"
    return data["token"], data["user"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def customer():
    t, u = _login(CUSTOMER_PHONE)
    return {"token": t, "user": u}


@pytest.fixture(scope="session")
def agent():
    t, u = _login(AGENT_PHONE)
    return {"token": t, "user": u}


@pytest.fixture(scope="session")
def admin():
    t, u = _login(ADMIN_PHONE)
    return {"token": t, "user": u}


# -------- AUTH --------
class TestAuth:
    def test_send_otp_dev_mode(self):
        r = requests.post(f"{API}/auth/send-otp", json={"phone": CUSTOMER_PHONE}, timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert j["status"] == "sent"
        # twilio token missing -> dev mode expected
        assert j.get("mode") == "dev"
        assert j.get("dev_code") == "123456"

    def test_verify_demo_customer(self, customer):
        assert customer["user"]["role"] == "customer"
        assert customer["user"]["phone"] == CUSTOMER_PHONE

    def test_verify_demo_agent(self, agent):
        assert agent["user"]["role"] == "agent"

    def test_verify_demo_admin(self, admin):
        assert admin["user"]["role"] == "admin"

    def test_invalid_otp_rejected(self):
        r = requests.post(f"{API}/auth/verify-otp", json={"phone": CUSTOMER_PHONE, "code": "000000"}, timeout=20)
        assert r.status_code == 400

    def test_new_phone_returns_registered_false(self):
        new_phone = "9000099999"
        # cleanup any prior test user via admin not needed; just try and if exists, accept
        requests.post(f"{API}/auth/send-otp", json={"phone": new_phone}, timeout=20)
        r = requests.post(f"{API}/auth/verify-otp", json={"phone": new_phone, "code": OTP}, timeout=20)
        assert r.status_code == 200
        j = r.json()
        # could be registered True if a previous test run created it -> accept either, but if False then register
        if j.get("registered") is False:
            r2 = requests.post(f"{API}/auth/register", json={
                "phone": new_phone, "name": "TEST New User", "apartment": "Test Apt"
            }, timeout=20)
            assert r2.status_code == 200
            assert "token" in r2.json()
            assert r2.json()["user"]["referral_code"]
            assert r2.json()["user"]["role"] == "customer"

    def test_me_endpoint(self, customer):
        r = requests.get(f"{API}/auth/me", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == customer["user"]["id"]


# -------- PRODUCTS --------
class TestProducts:
    def test_list_products(self):
        r = requests.get(f"{API}/products", timeout=20)
        assert r.status_code == 200
        products = r.json()
        assert len(products) > 5
        types = {p["type"] for p in products}
        assert {"milk", "vegetable", "fruit"}.issubset(types)
        # _id should be excluded
        assert all("_id" not in p for p in products)

    def test_filter_by_type(self):
        r = requests.get(f"{API}/products?type=milk", timeout=20)
        assert r.status_code == 200
        assert all(p["type"] == "milk" for p in r.json())

    def test_categories(self):
        r = requests.get(f"{API}/products/categories", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) > 0

    def test_get_product_by_id(self):
        all_p = requests.get(f"{API}/products", timeout=20).json()
        pid = all_p[0]["id"]
        r = requests.get(f"{API}/products/{pid}", timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == pid


# -------- SUBSCRIPTIONS + AUTOPAY --------
class TestSubscriptionsAutopay:
    sub_id = None

    def test_create_subscription(self, customer):
        milk = [p for p in requests.get(f"{API}/products?type=milk").json() if p["category"] == "Cow Milk"][0]
        r = requests.post(f"{API}/subscriptions", headers=_hdr(customer["token"]), json={
            "product_id": milk["id"], "milk_type": "Cow Milk",
            "quantity_label": "1 Liter", "quantity_ml": 1000,
            "schedule": "morning", "frequency": "daily"
        }, timeout=20)
        assert r.status_code == 200, r.text
        sub = r.json()
        assert sub["status"] == "active"
        assert sub["price_per_delivery"] > 0
        TestSubscriptionsAutopay.sub_id = sub["id"]

    def test_modify_pause_resume_skip(self, customer):
        sid = TestSubscriptionsAutopay.sub_id
        assert sid
        r = requests.put(f"{API}/subscriptions/{sid}", headers=_hdr(customer["token"]),
                         json={"quantity_label": "500 ml", "quantity_ml": 500}, timeout=20)
        assert r.status_code == 200
        assert r.json()["quantity_ml"] == 500

        r = requests.post(f"{API}/subscriptions/{sid}/pause", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "paused"

        r = requests.post(f"{API}/subscriptions/{sid}/resume", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "active"

        r = requests.post(f"{API}/subscriptions/{sid}/skip-tomorrow", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200 and len(r.json()["skip_dates"]) >= 1

    def test_autopay_setup_get_pause_cancel(self, customer):
        r = requests.post(f"{API}/autopay/setup", headers=_hdr(customer["token"]),
                          json={"max_amount": 3000, "app": "Google Pay"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "active"

        r = requests.get(f"{API}/autopay", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json()["mandate"]["status"] == "active"
        assert r.json()["estimated_monthly"] >= 0

        r = requests.post(f"{API}/autopay/pause", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200
        r = requests.post(f"{API}/autopay/cancel", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200


# -------- CART + COUPON + ORDER --------
class TestCartCheckout:
    order_id = None

    def test_cart_add_update_coupon_checkout(self, customer):
        veg = [p for p in requests.get(f"{API}/products?type=vegetable").json()][0]
        veg2 = [p for p in requests.get(f"{API}/products?type=vegetable").json()][1]
        # clean cart first
        requests.delete(f"{API}/cart/coupon", headers=_hdr(customer["token"]))
        # add 2 items so total > 199
        r = requests.post(f"{API}/cart/add", headers=_hdr(customer["token"]),
                          json={"product_id": veg["id"], "qty": 3}, timeout=20)
        assert r.status_code == 200
        r = requests.post(f"{API}/cart/add", headers=_hdr(customer["token"]),
                          json={"product_id": veg2["id"], "qty": 3}, timeout=20)
        assert r.status_code == 200
        cart = r.json()
        assert cart["subtotal"] > 0

        # update qty
        r = requests.put(f"{API}/cart/item", headers=_hdr(customer["token"]),
                         json={"product_id": veg["id"], "qty": 2}, timeout=20)
        assert r.status_code == 200

        # apply coupon FRESH20
        r = requests.post(f"{API}/cart/apply-coupon", headers=_hdr(customer["token"]),
                          json={"code": "FRESH20", "amount": cart["subtotal"]}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["discount"] > 0
        assert r.json()["coupon"]["code"] == "FRESH20"

        # invalid coupon
        r = requests.post(f"{API}/cart/apply-coupon", headers=_hdr(customer["token"]),
                          json={"code": "NOPE99", "amount": 500}, timeout=20)
        assert r.status_code == 400

        # re-apply WELCOME50
        requests.post(f"{API}/cart/apply-coupon", headers=_hdr(customer["token"]),
                      json={"code": "WELCOME50", "amount": 500}, timeout=20)

        # checkout UPI
        r = requests.post(f"{API}/orders/checkout", headers=_hdr(customer["token"]),
                          json={"slot": "morning", "payment_method": "upi"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        order = body["order"]
        assert order["amount"] > 0
        # razorpay live, so order should be created
        assert body.get("razorpay_key_id")
        assert order["razorpay_order"] is not None, "Expected real razorpay order creation"
        TestCartCheckout.order_id = order["id"]

    def test_confirm_payment_and_fetch(self, customer):
        oid = TestCartCheckout.order_id
        assert oid
        r = requests.post(f"{API}/orders/{oid}/confirm-payment", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json()["payment_status"] == "paid"
        assert r.json()["status"] == "packed"

        # GET order
        r = requests.get(f"{API}/orders/{oid}", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == oid
        assert "tracking" in r.json()

        # list active orders
        r = requests.get(f"{API}/orders?status=active", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# -------- REFERRALS / BILLING / TICKETS / AI --------
class TestMiscCustomer:
    def test_referrals_me(self, customer):
        r = requests.get(f"{API}/referrals/me", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert j["code"] and j["link"].startswith("https://")
        assert "stats" in j

    def test_billing_monthly(self, customer):
        r = requests.get(f"{API}/billing/monthly", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 200
        b = r.json()
        for k in ("milk_charges", "vegetable_charges", "tax", "final_amount", "month"):
            assert k in b

    def test_tickets_create_list(self, customer):
        r = requests.post(f"{API}/tickets", headers=_hdr(customer["token"]),
                          json={"category": "Delivery", "subject": "TEST Late",
                                "message": "TEST ticket"}, timeout=20)
        assert r.status_code == 200
        tid = r.json()["id"]
        r = requests.get(f"{API}/tickets", headers=_hdr(customer["token"]), timeout=20)
        assert any(t["id"] == tid for t in r.json())

    def test_ai_insights(self, customer):
        r = requests.get(f"{API}/ai/insights", headers=_hdr(customer["token"]), timeout=60)
        assert r.status_code == 200
        j = r.json()
        assert j["insight"] and len(j["insight"]) > 5
        assert "daily_ml" in j


# -------- AGENT --------
class TestAgent:
    def test_summary(self, agent):
        r = requests.get(f"{API}/agent/summary", headers=_hdr(agent["token"]), timeout=20)
        assert r.status_code == 200
        j = r.json()
        for k in ("total", "delivered", "pending", "failed"):
            assert k in j

    def test_route_has_stops(self, agent):
        r = requests.get(f"{API}/agent/route", headers=_hdr(agent["token"]), timeout=20)
        assert r.status_code == 200
        groups = r.json()
        total_stops = sum(len(g["stops"]) for g in groups)
        assert total_stops >= 3, f"Expected at least 3 seeded stops, got {total_stops}"

    def test_attendance_checkin_checkout(self, agent):
        r = requests.post(f"{API}/agent/attendance/checkin", headers=_hdr(agent["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json().get("check_in")
        r = requests.post(f"{API}/agent/attendance/checkout", headers=_hdr(agent["token"]), timeout=20)
        assert r.status_code == 200
        r = requests.get(f"{API}/agent/attendance/today", headers=_hdr(agent["token"]), timeout=20)
        assert r.status_code == 200

    def test_mark_delivered(self, agent):
        # find one agent order
        r = requests.get(f"{API}/agent/route", headers=_hdr(agent["token"]), timeout=20)
        stops = [s for g in r.json() for s in g["stops"] if s["status"] != "delivered"]
        if not stops:
            pytest.skip("No pending agent stops")
        oid = stops[0]["id"]
        r = requests.post(f"{API}/agent/delivery/{oid}/status", headers=_hdr(agent["token"]),
                          json={"status": "delivered", "note": "TEST delivered"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "delivered"

    def test_performance(self, agent):
        r = requests.get(f"{API}/agent/performance", headers=_hdr(agent["token"]), timeout=20)
        assert r.status_code == 200
        for k in ("completed", "total", "success_rate", "attendance_days"):
            assert k in r.json()

    def test_role_isolation(self, customer):
        # customer cannot hit agent endpoint
        r = requests.get(f"{API}/agent/summary", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 403


# -------- ADMIN --------
class TestAdmin:
    def test_dashboard(self, admin):
        r = requests.get(f"{API}/admin/dashboard", headers=_hdr(admin["token"]), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert "kpis" in j and "sales_chart" in j
        assert len(j["sales_chart"]) == 7
        for k in ("total_customers", "active_subscriptions", "today_orders"):
            assert k in j["kpis"]

    def test_customers_suspend_activate(self, admin, customer):
        r = requests.get(f"{API}/admin/customers", headers=_hdr(admin["token"]), timeout=20)
        assert r.status_code == 200
        cust_list = r.json()
        cid = customer["user"]["id"]
        assert any(c["id"] == cid for c in cust_list)
        r = requests.put(f"{API}/admin/customers/{cid}/suspend", headers=_hdr(admin["token"]), timeout=20)
        assert r.status_code == 200
        r = requests.put(f"{API}/admin/customers/{cid}/activate", headers=_hdr(admin["token"]), timeout=20)
        assert r.status_code == 200

    def test_orders_and_assign(self, admin, agent):
        r = requests.get(f"{API}/admin/orders", headers=_hdr(admin["token"]), timeout=20)
        assert r.status_code == 200
        orders = r.json()
        if not orders:
            pytest.skip("No orders to assign")
        oid = orders[0]["id"]
        r = requests.put(f"{API}/admin/orders/{oid}/assign?agent_id={agent['user']['id']}",
                         headers=_hdr(admin["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json()["agent_id"] == agent["user"]["id"]
        # set status
        r = requests.put(f"{API}/admin/orders/{oid}/status", headers=_hdr(admin["token"]),
                         json={"status": "delivered"}, timeout=20)
        assert r.status_code == 200

    def test_agents_products_inventory(self, admin):
        for ep in ("/admin/agents", "/admin/products", "/admin/inventory",
                  "/admin/referrals", "/admin/coupons", "/admin/tickets"):
            r = requests.get(f"{API}{ep}", headers=_hdr(admin["token"]), timeout=20)
            assert r.status_code == 200, f"{ep} failed: {r.text}"

    def test_disable_product(self, admin):
        prods = requests.get(f"{API}/admin/products", headers=_hdr(admin["token"])).json()
        pid = prods[-1]["id"]
        r = requests.delete(f"{API}/admin/products/{pid}", headers=_hdr(admin["token"]), timeout=20)
        assert r.status_code == 200

    def test_ai_predictions(self, admin):
        r = requests.get(f"{API}/admin/ai-predictions", headers=_hdr(admin["token"]), timeout=60)
        assert r.status_code == 200
        j = r.json()
        assert j.get("forecast") and len(j["forecast"]) > 5

    def test_unauthorized_admin_access(self, customer):
        r = requests.get(f"{API}/admin/dashboard", headers=_hdr(customer["token"]), timeout=20)
        assert r.status_code == 403
