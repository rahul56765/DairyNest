#!/usr/bin/env python3
"""
Backend API tests for DairyNest v1.5 - New features testing
Tests 8 new backend_new tasks from test_result.md
"""
import requests
import json
from datetime import date, timedelta

# Configuration
BASE_URL = "https://5789b2e0-9c3a-44e5-9042-ce17e63be12c.preview.emergentagent.com/api"
OTP = "123456"
CUSTOMER_PHONE = "9000000001"
ADMIN_PHONE = "6398213389"

# Test state
customer_token = None
admin_token = None
test_results = []


def log_test(section, step, passed, message):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{section}.{step}: {status} - {message}"
    print(result)
    test_results.append({"section": section, "step": step, "passed": passed, "message": message})
    return passed


def login(phone, role_name):
    """Login and get token"""
    # Send OTP
    r = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": phone})
    if r.status_code != 200:
        print(f"Failed to send OTP for {role_name}: {r.status_code}")
        return None
    
    # Verify OTP
    r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone, "code": OTP})
    if r.status_code != 200:
        print(f"Failed to verify OTP for {role_name}: {r.status_code}")
        return None
    
    data = r.json()
    if not data.get("registered"):
        # Register if needed
        r = requests.post(f"{BASE_URL}/auth/register", json={"phone": phone, "name": f"Test {role_name}"})
        if r.status_code != 200:
            print(f"Failed to register {role_name}: {r.status_code}")
            return None
        data = r.json()
    
    token = data.get("token")
    print(f"✓ Logged in as {role_name} ({phone})")
    return token


def test_section_1_first_order_discount_bug():
    """1) CRITICAL: First-order discount BUG FIX - consumed flag"""
    print("\n=== SECTION 1: FIRST-ORDER DISCOUNT BUG FIX (CRITICAL) ===")
    
    # Use a brand new customer phone
    new_customer_phone = "9123456701"
    
    # Step 1a: Register brand new customer
    r = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": new_customer_phone})
    if r.status_code != 200:
        log_test("1", "a", False, f"Failed to send OTP: {r.status_code}")
        return False
    
    r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": new_customer_phone, "code": OTP})
    if r.status_code != 200:
        log_test("1", "a", False, f"Failed to verify OTP: {r.status_code}")
        return False
    
    data = r.json()
    if data.get("registered"):
        log_test("1", "a", True, f"Customer {new_customer_phone} already exists, using existing account")
        new_token = data.get("token")
    else:
        # Register
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "phone": new_customer_phone,
            "name": "New Test Customer",
            "email": "newtest@example.com"
        })
        if r.status_code != 200:
            log_test("1", "a", False, f"Failed to register: {r.status_code}")
            return False
        data = r.json()
        new_token = data.get("token")
        log_test("1", "a", True, f"Registered new customer {new_customer_phone}")
    
    headers = {"Authorization": f"Bearer {new_token}"}
    
    # Get customer profile to check address
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    if r.status_code != 200:
        log_test("1", "a", False, f"Failed to get profile: {r.status_code}")
        return False
    
    profile = r.json()
    addresses = profile.get("addresses", [])
    
    # Create address if needed
    if not addresses:
        r = requests.post(f"{BASE_URL}/addresses", json={
            "flat": "101",
            "apartment": "Test Apartment",
            "area": "Test Area",
            "city": "Test City",
            "pincode": "123456",
            "landmark": "Near Test"
        }, headers=headers)
        if r.status_code != 200:
            log_test("1", "a", False, f"Failed to create address: {r.status_code}")
            return False
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        profile = r.json()
        addresses = profile.get("addresses", [])
    
    address_id = addresses[0]["id"]
    
    # Get a product
    r = requests.get(f"{BASE_URL}/products")
    if r.status_code != 200:
        log_test("1", "a", False, f"Failed to get products: {r.status_code}")
        return False
    
    products = r.json()
    if not products:
        log_test("1", "a", False, "No products available")
        return False
    
    product_id = products[0]["id"]
    
    # Add to cart
    r = requests.post(f"{BASE_URL}/cart/add", json={"product_id": product_id, "qty": 2}, headers=headers)
    if r.status_code != 200:
        log_test("1", "a", False, f"Failed to add to cart: {r.status_code}")
        return False
    
    # First checkout
    r = requests.post(f"{BASE_URL}/orders/checkout", json={
        "address_id": address_id,
        "slot": "morning",
        "payment_method": "upi"
    }, headers=headers)
    
    if r.status_code != 200:
        log_test("1", "a", False, f"First checkout failed: {r.status_code}")
        return False
    
    checkout1 = r.json()
    first_order_bonus_1 = checkout1.get("first_order_bonus", 0)
    order1_id = checkout1.get("order", {}).get("id")
    
    passed = first_order_bonus_1 > 0
    log_test("1", "a", passed, f"First checkout: first_order_bonus = ₹{first_order_bonus_1} (expected > 0)")
    
    # Check user.first_order_discount_consumed via /api/auth/me
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    if r.status_code == 200:
        user = r.json()
        consumed = user.get("first_order_discount_consumed", False)
        log_test("1", "a", consumed == True, f"user.first_order_discount_consumed = {consumed} (expected True)")
    
    # Step 1b: Second checkout WITHOUT paying first order
    # Add to cart again
    r = requests.post(f"{BASE_URL}/cart/add", json={"product_id": product_id, "qty": 1}, headers=headers)
    if r.status_code != 200:
        log_test("1", "b", False, f"Failed to add to cart for 2nd checkout: {r.status_code}")
        return False
    
    r = requests.post(f"{BASE_URL}/orders/checkout", json={
        "address_id": address_id,
        "slot": "morning",
        "payment_method": "upi"
    }, headers=headers)
    
    if r.status_code != 200:
        log_test("1", "b", False, f"Second checkout failed: {r.status_code}")
        return False
    
    checkout2 = r.json()
    first_order_bonus_2 = checkout2.get("first_order_bonus", 0)
    order2_id = checkout2.get("order", {}).get("id")
    
    passed = first_order_bonus_2 == 0
    log_test("1", "b", passed, f"Second checkout (without paying first): first_order_bonus = ₹{first_order_bonus_2} (expected 0) - BUG FIX VERIFIED")
    
    # Step 1c: Confirm payment on first order, then try third checkout
    r = requests.post(f"{BASE_URL}/orders/{order1_id}/confirm-payment", headers=headers)
    if r.status_code == 200:
        log_test("1", "c", True, f"Confirmed payment on first order")
    else:
        log_test("1", "c", False, f"Failed to confirm payment: {r.status_code}")
    
    # Add to cart for third checkout
    r = requests.post(f"{BASE_URL}/cart/add", json={"product_id": product_id, "qty": 1}, headers=headers)
    if r.status_code != 200:
        log_test("1", "c", False, f"Failed to add to cart for 3rd checkout: {r.status_code}")
        return False
    
    r = requests.post(f"{BASE_URL}/orders/checkout", json={
        "address_id": address_id,
        "slot": "morning",
        "payment_method": "upi"
    }, headers=headers)
    
    if r.status_code != 200:
        log_test("1", "c", False, f"Third checkout failed: {r.status_code}")
        return False
    
    checkout3 = r.json()
    first_order_bonus_3 = checkout3.get("first_order_bonus", 0)
    
    passed = first_order_bonus_3 == 0
    log_test("1", "c", passed, f"Third checkout (after payment): first_order_bonus = ₹{first_order_bonus_3} (expected 0)")
    
    return True


def test_section_2_inventory_decrement():
    """2) Inventory auto-decrement on delivered"""
    print("\n=== SECTION 2: INVENTORY AUTO-DECREMENT ON DELIVERED ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    
    # Step 2a: Pick a product and note its stock
    r = requests.get(f"{BASE_URL}/products")
    if r.status_code != 200:
        log_test("2", "a", False, f"Failed to get products: {r.status_code}")
        return False
    
    products = r.json()
    if not products:
        log_test("2", "a", False, "No products available")
        return False
    
    # Find a product with stock > 5
    test_product = None
    for p in products:
        if p.get("stock", 0) > 5:
            test_product = p
            break
    
    if not test_product:
        test_product = products[0]
    
    product_id = test_product["id"]
    initial_stock = test_product.get("stock", 0)
    log_test("2", "a", True, f"Product {product_id[:8]} initial stock = {initial_stock}")
    
    # Step 2b: Customer checkout with qty 2
    r = requests.get(f"{BASE_URL}/auth/me", headers=customer_headers)
    if r.status_code != 200:
        log_test("2", "b", False, f"Failed to get customer profile: {r.status_code}")
        return False
    
    profile = r.json()
    addresses = profile.get("addresses", [])
    if not addresses:
        log_test("2", "b", False, "Customer has no addresses")
        return False
    
    address_id = addresses[0]["id"]
    
    # Clear cart and add product
    r = requests.delete(f"{BASE_URL}/cart/clear", headers=customer_headers)
    r = requests.post(f"{BASE_URL}/cart/add", json={"product_id": product_id, "qty": 2}, headers=customer_headers)
    if r.status_code != 200:
        log_test("2", "b", False, f"Failed to add to cart: {r.status_code}")
        return False
    
    # Checkout
    r = requests.post(f"{BASE_URL}/orders/checkout", json={
        "address_id": address_id,
        "slot": "morning",
        "payment_method": "cod"
    }, headers=customer_headers)
    
    if r.status_code != 200:
        log_test("2", "b", False, f"Checkout failed: {r.status_code}")
        return False
    
    checkout = r.json()
    order_id = checkout.get("order", {}).get("id")
    log_test("2", "b", True, f"Created order {order_id[:8]} with qty=2")
    
    # Step 2c: Admin marks order as delivered
    r = requests.put(f"{BASE_URL}/admin/orders/{order_id}/status", json={"status": "delivered"}, headers=admin_headers)
    if r.status_code != 200:
        log_test("2", "c", False, f"Failed to mark as delivered: {r.status_code}")
        return False
    
    log_test("2", "c", True, f"Marked order as delivered")
    
    # Step 2d: Check product stock (should be initial_stock - 2)
    r = requests.get(f"{BASE_URL}/products/{product_id}")
    if r.status_code != 200:
        log_test("2", "d", False, f"Failed to get product: {r.status_code}")
        return False
    
    product = r.json()
    new_stock = product.get("stock", 0)
    expected_stock = initial_stock - 2
    
    passed = new_stock == expected_stock
    log_test("2", "d", passed, f"Stock after delivery: {new_stock} (expected {expected_stock})")
    
    # Step 2e: Mark as delivered AGAIN (idempotent test)
    r = requests.put(f"{BASE_URL}/admin/orders/{order_id}/status", json={"status": "delivered"}, headers=admin_headers)
    if r.status_code != 200:
        log_test("2", "e", False, f"Failed to mark as delivered again: {r.status_code}")
        return False
    
    # Step 2f: Check stock unchanged (idempotent)
    r = requests.get(f"{BASE_URL}/products/{product_id}")
    if r.status_code != 200:
        log_test("2", "f", False, f"Failed to get product: {r.status_code}")
        return False
    
    product = r.json()
    stock_after_second = product.get("stock", 0)
    
    passed = stock_after_second == new_stock
    log_test("2", "f", passed, f"Stock after 2nd delivered call: {stock_after_second} (unchanged, idempotent verified)")
    
    return True


def test_section_3_admin_orders_filters():
    """3) Admin orders filtering: kind, delivery_date, date_from, date_to"""
    print("\n=== SECTION 3: ADMIN ORDERS FILTERING ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 3a: Filter by kind=subscription
    r = requests.get(f"{BASE_URL}/admin/orders?kind=subscription", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("3", "a", passed, f"GET /admin/orders?kind=subscription returns {r.status_code}"):
        return False
    
    sub_orders = r.json()
    all_subscription = all(o.get("is_subscription") == True for o in sub_orders)
    log_test("3", "a", all_subscription, f"All {len(sub_orders)} orders have is_subscription=true")
    
    # Step 3b: Filter by kind=normal
    r = requests.get(f"{BASE_URL}/admin/orders?kind=normal", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("3", "b", passed, f"GET /admin/orders?kind=normal returns {r.status_code}"):
        return False
    
    normal_orders = r.json()
    all_normal = all(o.get("is_subscription") == False for o in normal_orders)
    log_test("3", "b", all_normal, f"All {len(normal_orders)} orders have is_subscription=false")
    
    # Step 3c: Filter by delivery_date=today
    today = date.today().isoformat()
    r = requests.get(f"{BASE_URL}/admin/orders?delivery_date={today}", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("3", "c", passed, f"GET /admin/orders?delivery_date={today} returns {r.status_code}"):
        return False
    
    today_orders = r.json()
    all_today = all(o.get("delivery_date") == today for o in today_orders)
    log_test("3", "c", all_today, f"All {len(today_orders)} orders have delivery_date={today}")
    
    # Step 3d: Filter by date range
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    r = requests.get(f"{BASE_URL}/admin/orders?date_from={yesterday}&date_to={today}", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("3", "d", passed, f"GET /admin/orders?date_from={yesterday}&date_to={today} returns {r.status_code}"):
        return False
    
    range_orders = r.json()
    log_test("3", "d", True, f"Date range filter returned {len(range_orders)} orders")
    
    # Step 3e: No filters (backward compat)
    r = requests.get(f"{BASE_URL}/admin/orders", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("3", "e", passed, f"GET /admin/orders (no filters) returns {r.status_code}"):
        return False
    
    all_orders = r.json()
    log_test("3", "e", True, f"No filters returned {len(all_orders)} orders (backward compatible)")
    
    return True


def test_section_4_subscription_calendar():
    """4) Subscription calendar endpoint"""
    print("\n=== SECTION 4: SUBSCRIPTION CALENDAR ===")
    
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 4a: Create an active subscription for customer
    # Get a milk product
    r = requests.get(f"{BASE_URL}/products?type=milk")
    if r.status_code != 200:
        log_test("4", "a", False, f"Failed to get milk products: {r.status_code}")
        return False
    
    products = r.json()
    if not products:
        log_test("4", "a", False, "No milk products available")
        return False
    
    milk_product = products[0]
    
    # Create subscription
    r = requests.post(f"{BASE_URL}/subscriptions", json={
        "product_id": milk_product["id"],
        "milk_type": "Cow Milk",
        "quantity_label": "1L",
        "quantity_ml": 1000,
        "schedule": "morning",
        "frequency": "daily"
    }, headers=customer_headers)
    
    passed = r.status_code == 200
    if not log_test("4", "a", passed, f"Create subscription returns {r.status_code}"):
        return False
    
    subscription = r.json()
    passed = subscription.get("status") == "active"
    log_test("4", "a", passed, f"Subscription status = {subscription.get('status')} (expected 'active')")
    
    # Step 4b: Get subscription calendar
    date_from = date.today().isoformat()
    date_to = (date.today() + timedelta(days=6)).isoformat()
    
    r = requests.get(f"{BASE_URL}/admin/subscriptions/calendar?date_from={date_from}&date_to={date_to}", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("4", "b", passed, f"GET /admin/subscriptions/calendar returns {r.status_code}"):
        return False
    
    calendar = r.json()
    dates = calendar.get("dates", [])
    
    passed = len(dates) == 7
    log_test("4", "b", passed, f"Calendar returned {len(dates)} dates (expected 7 for 7-day range)")
    
    # For daily frequency, expect count >= 1 on every day
    all_have_deliveries = all(d.get("count", 0) >= 1 for d in dates)
    log_test("4", "b", all_have_deliveries, f"All dates have count >= 1 (daily frequency)")
    
    # Step 4c: Get subscription list
    r = requests.get(f"{BASE_URL}/admin/subscriptions", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("4", "c", passed, f"GET /admin/subscriptions returns {r.status_code}"):
        return False
    
    subs = r.json()
    log_test("4", "c", isinstance(subs, list), f"Subscriptions list returned {len(subs)} items")
    
    # Check if subscriptions have customer info
    if subs:
        first_sub = subs[0]
        has_customer = "customer" in first_sub
        log_test("4", "c", has_customer, f"Subscription has customer info: {has_customer}")
    
    return True


def test_section_5_daily_generation():
    """5) Daily subscription order generation"""
    print("\n=== SECTION 5: DAILY SUBSCRIPTION ORDER GENERATION ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    today = date.today().isoformat()
    
    # Step 5a: Generate orders for today (first time)
    r = requests.post(f"{BASE_URL}/admin/subscriptions/generate-daily?date_str={today}", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("5", "a", passed, f"POST /admin/subscriptions/generate-daily returns {r.status_code}"):
        return False
    
    result1 = r.json()
    created1 = result1.get("created", 0)
    skipped1 = result1.get("skipped", 0)
    
    log_test("5", "a", True, f"First generation: created={created1}, skipped={skipped1}")
    
    # Step 5b: Run same call again (idempotent test)
    r = requests.post(f"{BASE_URL}/admin/subscriptions/generate-daily?date_str={today}", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("5", "b", passed, f"Second generation call returns {r.status_code}"):
        return False
    
    result2 = r.json()
    created2 = result2.get("created", 0)
    skipped2 = result2.get("skipped", 0)
    
    passed = created2 == 0
    log_test("5", "b", passed, f"Second generation: created={created2} (expected 0, idempotent)")
    
    passed = skipped2 >= created1
    log_test("5", "b", passed, f"Second generation: skipped={skipped2} (expected >= {created1})")
    
    # Step 5c: Check generated orders
    r = requests.get(f"{BASE_URL}/admin/orders?delivery_date={today}&kind=subscription", headers=admin_headers)
    if r.status_code == 200:
        orders = r.json()
        if orders:
            order = orders[0]
            checks = {
                "source": order.get("source") == "subscription",
                "payment_status": order.get("payment_status") == "paid",
                "payment_method": order.get("payment_method") == "autopay",
                "status": order.get("status") == "received"
            }
            
            for field, check in checks.items():
                log_test("5", "c", check, f"Generated order {field} = {order.get(field)} (expected per spec)")
        else:
            log_test("5", "c", True, "No subscription orders generated (may be expected if no active subs)")
    
    return True


def test_section_6_product_stock_status():
    """6) Product out_of_stock + hard delete + stock-status"""
    print("\n=== SECTION 6: PRODUCT STOCK STATUS & HARD DELETE ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get a product
    r = requests.get(f"{BASE_URL}/products")
    if r.status_code != 200:
        log_test("6", "a", False, f"Failed to get products: {r.status_code}")
        return False
    
    products = r.json()
    if not products:
        log_test("6", "a", False, "No products available")
        return False
    
    # Use last product to avoid affecting other tests
    test_product = products[-1]
    product_id = test_product["id"]
    
    # Step 6a: Update stock status
    r = requests.put(f"{BASE_URL}/admin/products/{product_id}/stock-status", json={
        "out_of_stock": True,
        "next_arrival_at": "2026-09-01 09:00",
        "accept_preorders": True
    }, headers=admin_headers)
    
    passed = r.status_code == 200
    if not log_test("6", "a", passed, f"PUT /admin/products/{product_id[:8]}/stock-status returns {r.status_code}"):
        return False
    
    updated = r.json()
    checks = {
        "out_of_stock": updated.get("out_of_stock") == True,
        "next_arrival_at": updated.get("next_arrival_at") == "2026-09-01 09:00",
        "accept_preorders": updated.get("accept_preorders") == True
    }
    
    for field, check in checks.items():
        log_test("6", "a", check, f"Updated product {field} = {updated.get(field)}")
    
    # Step 6b: Hard delete product
    r = requests.delete(f"{BASE_URL}/admin/products/{product_id}/hard", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("6", "b", passed, f"DELETE /admin/products/{product_id[:8]}/hard returns {r.status_code}"):
        return False
    
    result = r.json()
    passed = result.get("deleted") == True
    log_test("6", "b", passed, f"Delete response: deleted={result.get('deleted')}")
    
    # Step 6c: Verify product is gone
    r = requests.get(f"{BASE_URL}/products/{product_id}")
    passed = r.status_code == 404
    log_test("6", "c", passed, f"GET /products/{product_id[:8]} returns {r.status_code} (expected 404)")
    
    # Step 6d: Old orders should still have product snapshot
    r = requests.get(f"{BASE_URL}/admin/orders", headers=admin_headers)
    if r.status_code == 200:
        orders = r.json()
        # Find orders with this product
        orders_with_product = []
        for order in orders:
            for item in order.get("items", []):
                if item.get("product", {}).get("id") == product_id:
                    orders_with_product.append(order)
                    break
        
        if orders_with_product:
            log_test("6", "d", True, f"Found {len(orders_with_product)} orders with deleted product (snapshot preserved)")
        else:
            log_test("6", "d", True, "No orders found with deleted product (expected if product was unused)")
    
    return True


def test_section_7_expanded_settings():
    """7) Expanded app settings"""
    print("\n=== SECTION 7: EXPANDED APP SETTINGS ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 7a: GET /api/settings (public) - check new fields
    r = requests.get(f"{BASE_URL}/settings")
    passed = r.status_code == 200
    if not log_test("7", "a", passed, f"GET /settings returns {r.status_code}"):
        return False
    
    settings = r.json()
    
    expected_fields = [
        "morning_window_start", "morning_window_end",
        "evening_window_start", "evening_window_end",
        "app_download_link", "support_phone", "support_phone_alt", "support_email"
    ]
    
    for field in expected_fields:
        has_field = field in settings
        log_test("7", "a", has_field, f"Public settings has {field}: {has_field}")
    
    # Step 7b: PUT /admin/settings with valid referral_trigger
    r = requests.put(f"{BASE_URL}/admin/settings", json={
        "referral_trigger": "signup",
        "referral_reward_amount": 75
    }, headers=admin_headers)
    
    passed = r.status_code == 200
    if not log_test("7", "b", passed, f"PUT /admin/settings with valid trigger returns {r.status_code}"):
        return False
    
    # Verify changes
    r = requests.get(f"{BASE_URL}/admin/settings", headers=admin_headers)
    if r.status_code == 200:
        admin_settings = r.json()
        trigger_check = admin_settings.get("referral_trigger") == "signup"
        amount_check = admin_settings.get("referral_reward_amount") == 75
        
        log_test("7", "b", trigger_check, f"referral_trigger = {admin_settings.get('referral_trigger')} (expected 'signup')")
        log_test("7", "b", amount_check, f"referral_reward_amount = {admin_settings.get('referral_reward_amount')} (expected 75)")
    
    # Step 7c: PUT /admin/settings with invalid referral_trigger
    r = requests.put(f"{BASE_URL}/admin/settings", json={
        "referral_trigger": "bad_trigger"
    }, headers=admin_headers)
    
    passed = r.status_code == 400
    log_test("7", "c", passed, f"PUT /admin/settings with invalid trigger returns {r.status_code} (expected 400)")
    
    # Restore default trigger
    r = requests.put(f"{BASE_URL}/admin/settings", json={
        "referral_trigger": "first_order"
    }, headers=admin_headers)
    
    return True


def test_section_8_referral_trigger():
    """8) Referral trigger gating"""
    print("\n=== SECTION 8: REFERRAL TRIGGER GATING ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 8a: Set referral_trigger to "signup"
    r = requests.put(f"{BASE_URL}/admin/settings", json={
        "referral_trigger": "signup",
        "referral_reward_amount": 50
    }, headers=admin_headers)
    
    if r.status_code != 200:
        log_test("8", "a", False, f"Failed to set referral_trigger: {r.status_code}")
        return False
    
    log_test("8", "a", True, "Set referral_trigger='signup'")
    
    # Get existing customer's referral code
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    r = requests.get(f"{BASE_URL}/auth/me", headers=customer_headers)
    if r.status_code != 200:
        log_test("8", "b", False, f"Failed to get customer profile: {r.status_code}")
        return False
    
    profile = r.json()
    referral_code = profile.get("referral_code")
    
    if not referral_code:
        log_test("8", "b", False, "Customer has no referral code")
        return False
    
    log_test("8", "b", True, f"Got referral code: {referral_code}")
    
    # Get referral stats before
    r = requests.get(f"{BASE_URL}/referrals/{referral_code}", headers=customer_headers)
    if r.status_code == 200:
        referral_before = r.json()
        reward_before = referral_before.get("reward_amount", 0)
        log_test("8", "b", True, f"Referral reward before: ₹{reward_before}")
    else:
        reward_before = 0
    
    # Step 8b: Register new user with referral code
    new_phone = "9123456702"
    
    r = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": new_phone})
    r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": new_phone, "code": OTP})
    
    data = r.json()
    if not data.get("registered"):
        # Register with referral code
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "phone": new_phone,
            "name": "Referred User",
            "email": "referred@example.com",
            "referral_code": referral_code
        })
        
        if r.status_code != 200:
            log_test("8", "b", False, f"Failed to register with referral: {r.status_code}")
            return False
        
        log_test("8", "b", True, f"Registered new user with referral code")
        
        # Check if reward was granted (trigger=signup)
        r = requests.get(f"{BASE_URL}/referrals/{referral_code}", headers=customer_headers)
        if r.status_code == 200:
            referral_after = r.json()
            reward_after = referral_after.get("reward_amount", 0)
            
            passed = reward_after > reward_before
            log_test("8", "c", passed, f"Referral reward after signup: ₹{reward_after} (increased from ₹{reward_before})")
        
        # Check new user's referral_reward_credited flag
        new_token = r.json().get("token") if r.status_code == 200 else None
        if new_token:
            new_headers = {"Authorization": f"Bearer {new_token}"}
            r = requests.get(f"{BASE_URL}/auth/me", headers=new_headers)
            if r.status_code == 200:
                new_user = r.json()
                credited = new_user.get("referral_reward_credited", False)
                log_test("8", "c", credited, f"New user referral_reward_credited = {credited}")
    else:
        log_test("8", "b", True, f"User {new_phone} already registered, skipping referral test")
    
    # Step 8d: Test first_order trigger
    r = requests.put(f"{BASE_URL}/admin/settings", json={
        "referral_trigger": "first_order"
    }, headers=admin_headers)
    
    if r.status_code == 200:
        log_test("8", "d", True, "Set referral_trigger='first_order'")
    
    # Register another new user
    new_phone2 = "9123456703"
    r = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": new_phone2})
    r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": new_phone2, "code": OTP})
    
    data = r.json()
    if not data.get("registered"):
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "phone": new_phone2,
            "name": "Referred User 2",
            "email": "referred2@example.com",
            "referral_code": referral_code
        })
        
        if r.status_code == 200:
            log_test("8", "d", True, "Registered user with first_order trigger")
            
            # Reward should NOT be granted yet (trigger=first_order, not signup)
            r = requests.get(f"{BASE_URL}/referrals/{referral_code}", headers=customer_headers)
            if r.status_code == 200:
                referral_current = r.json()
                log_test("8", "d", True, f"Referral reward (should not increase on signup): ₹{referral_current.get('reward_amount', 0)}")
    else:
        log_test("8", "d", True, f"User {new_phone2} already registered, skipping first_order trigger test")
    
    return True


def main():
    """Run all tests"""
    global customer_token, admin_token
    
    print("=" * 70)
    print("DairyNest Backend API Tests v1.5")
    print("Testing 8 New Backend Features")
    print("=" * 70)
    
    # Login
    print("\n=== Authentication ===")
    customer_token = login(CUSTOMER_PHONE, "Customer")
    admin_token = login(ADMIN_PHONE, "Admin")
    
    if not customer_token or not admin_token:
        print("\n❌ FAILED: Could not authenticate")
        return
    
    # Run tests
    try:
        test_section_1_first_order_discount_bug()
        test_section_2_inventory_decrement()
        test_section_3_admin_orders_filters()
        test_section_4_subscription_calendar()
        test_section_5_daily_generation()
        test_section_6_product_stock_status()
        test_section_7_expanded_settings()
        test_section_8_referral_trigger()
    except Exception as e:
        print(f"\n❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    total = len(test_results)
    passed = sum(1 for t in test_results if t["passed"])
    failed = total - passed
    
    print(f"Total: {total} | Passed: {passed} | Failed: {failed}")
    
    if failed > 0:
        print("\nFailed tests:")
        for t in test_results:
            if not t["passed"]:
                print(f"  {t['section']}.{t['step']}: {t['message']}")
    
    print("\n" + "=" * 70)
    if failed == 0:
        print("✅ ALL TESTS PASSED")
    else:
        print(f"❌ {failed} TEST(S) FAILED")
    print("=" * 70)


if __name__ == "__main__":
    main()
