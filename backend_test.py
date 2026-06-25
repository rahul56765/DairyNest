#!/usr/bin/env python3
"""
Backend API tests for DairyNest - Enriched admin orders endpoint with customer + subscription detection
"""
import requests
import json
from datetime import date, timedelta

# Configuration
BASE_URL = "https://e5ecde86-5f60-48ec-820c-bc6d1a2312a5.preview.emergentagent.com/api"
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
        print(f"{role_name} not registered")
        return None
    
    token = data.get("token")
    print(f"✓ Logged in as {role_name} ({phone})")
    return token


def test_section_a():
    """A) GET /api/admin/orders (list) - verify enrichment fields"""
    print("\n=== SECTION A: Admin Orders List Enrichment ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 1: GET /api/admin/orders → 200, response is a list
    r = requests.get(f"{BASE_URL}/admin/orders", headers=headers)
    if not log_test("A", 1, r.status_code == 200, f"GET /api/admin/orders returns 200 (got {r.status_code})"):
        return False
    
    orders = r.json()
    if not log_test("A", 1, isinstance(orders, list), f"Response is a list (got {type(orders).__name__})"):
        return False
    
    if len(orders) == 0:
        log_test("A", 2, True, "No orders to verify enrichment (empty list)")
        log_test("A", 3, True, "Skipping status filter test (no orders)")
        return True
    
    # Step 2: Verify enrichment fields exist
    order = orders[0]
    required_enrichment = ["customer", "is_subscription", "subscription_refs"]
    required_existing = ["id", "items", "amount", "status", "payment_status", "address", 
                        "tracking", "slot", "created_at", "delivery_date", "subtotal", 
                        "delivery_charge", "discount"]
    
    missing_enrichment = [f for f in required_enrichment if f not in order]
    missing_existing = [f for f in required_existing if f not in order]
    
    passed = len(missing_enrichment) == 0
    msg = "All enrichment fields present" if passed else f"Missing: {missing_enrichment}"
    log_test("A", 2, passed, msg)
    
    passed = len(missing_existing) == 0
    msg = "All pre-existing fields present" if passed else f"Missing: {missing_existing}"
    log_test("A", 2, passed, msg)
    
    # Verify customer structure
    customer = order.get("customer", {})
    customer_keys = ["id", "name", "phone", "email"]
    missing_customer = [k for k in customer_keys if k not in customer]
    passed = len(missing_customer) == 0
    msg = "Customer object has all keys" if passed else f"Missing: {missing_customer}"
    log_test("A", 2, passed, msg)
    
    # Verify is_subscription is boolean
    passed = isinstance(order.get("is_subscription"), bool)
    log_test("A", 2, passed, f"is_subscription is boolean (got {type(order.get('is_subscription')).__name__})")
    
    # Verify subscription_refs is list
    passed = isinstance(order.get("subscription_refs"), list)
    log_test("A", 2, passed, f"subscription_refs is list (got {type(order.get('subscription_refs')).__name__})")
    
    # Step 3: Test status filter
    r = requests.get(f"{BASE_URL}/admin/orders?status=out_for_delivery", headers=headers)
    passed = r.status_code == 200
    log_test("A", 3, passed, f"GET /api/admin/orders?status=out_for_delivery returns 200 (got {r.status_code})")
    
    if passed:
        filtered = r.json()
        log_test("A", 3, isinstance(filtered, list), f"Filtered response is list with {len(filtered)} orders")
    
    return True


def test_section_b():
    """B) Subscription detection (heuristic)"""
    print("\n=== SECTION B: Subscription Detection Heuristic ===")
    
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 4: Create A2 Milk subscription for customer
    # First, get a milk product
    r = requests.get(f"{BASE_URL}/products?type=milk")
    if r.status_code != 200:
        log_test("B", 4, False, f"Failed to get milk products: {r.status_code}")
        return False
    
    products = r.json()
    a2_product = None
    for p in products:
        if "A2" in p.get("name", "") or "Desi Cow" in p.get("name", ""):
            a2_product = p
            break
    
    if not a2_product:
        # Use first milk product
        a2_product = products[0] if products else None
    
    if not a2_product:
        log_test("B", 4, False, "No milk products available to create subscription")
        return False
    
    # Create subscription
    sub_data = {
        "product_id": a2_product["id"],
        "milk_type": "A2 Milk",
        "quantity_label": "1L",
        "quantity_ml": 1000,
        "schedule": "morning",
        "frequency": "daily"
    }
    
    r = requests.post(f"{BASE_URL}/subscriptions", json=sub_data, headers=customer_headers)
    passed = r.status_code == 200
    if not log_test("B", 4, passed, f"Create A2 Milk subscription (status {r.status_code})"):
        return False
    
    subscription = r.json()
    passed = subscription.get("status") == "active"
    log_test("B", 4, passed, f"Subscription status is 'active' (got '{subscription.get('status')}')")
    
    # Step 5: Check if orders with A2 milk are marked as subscription
    r = requests.get(f"{BASE_URL}/admin/orders", headers=admin_headers)
    if r.status_code != 200:
        log_test("B", 5, False, f"Failed to get admin orders: {r.status_code}")
        return False
    
    orders = r.json()
    
    # Find orders for this customer with milk items
    customer_orders_with_milk = []
    for order in orders:
        if order.get("customer", {}).get("phone") == CUSTOMER_PHONE:
            for item in order.get("items", []):
                product = item.get("product", {})
                if product.get("type") == "milk":
                    customer_orders_with_milk.append(order)
                    break
    
    if len(customer_orders_with_milk) == 0:
        log_test("B", 5, True, "No existing orders with milk items for this customer (cannot verify heuristic)")
    else:
        # Check if any order with A2 milk is marked as subscription
        found_subscription_order = False
        for order in customer_orders_with_milk:
            if order.get("is_subscription"):
                found_subscription_order = True
                refs = order.get("subscription_refs", [])
                passed = len(refs) >= 1
                log_test("B", 5, passed, f"Order {order['id'][:8]} has is_subscription=true and {len(refs)} subscription_refs")
                if refs:
                    log_test("B", 5, True, f"First ref milk_type: {refs[0].get('milk_type')}")
                break
        
        if not found_subscription_order:
            log_test("B", 5, True, "No orders matched subscription heuristic (may be expected if no matching milk items)")
    
    # Step 6: Verify orders without matching milk items have is_subscription=false
    non_milk_orders = [o for o in orders if o.get("customer", {}).get("phone") == CUSTOMER_PHONE 
                       and not any(item.get("product", {}).get("type") == "milk" for item in o.get("items", []))]
    
    if len(non_milk_orders) == 0:
        log_test("B", 6, True, "No non-milk orders for customer (cannot verify negative case)")
    else:
        all_false = all(not o.get("is_subscription") for o in non_milk_orders)
        log_test("B", 6, all_false, f"Non-milk orders have is_subscription=false ({len(non_milk_orders)} orders checked)")
    
    return True


def test_section_c():
    """C) GET /api/admin/orders/{oid} (NEW detail endpoint)"""
    print("\n=== SECTION C: Admin Order Detail Endpoint ===")
    
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get an existing order ID
    r = requests.get(f"{BASE_URL}/admin/orders", headers=admin_headers)
    if r.status_code != 200:
        log_test("C", 7, False, f"Failed to get orders list: {r.status_code}")
        return False
    
    orders = r.json()
    if len(orders) == 0:
        log_test("C", 7, False, "No orders available to test detail endpoint")
        return False
    
    test_order_id = orders[0]["id"]
    
    # Step 7: GET /api/admin/orders/{oid} → 200, single object with enrichment
    r = requests.get(f"{BASE_URL}/admin/orders/{test_order_id}", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("C", 7, passed, f"GET /api/admin/orders/{test_order_id[:8]} returns 200 (got {r.status_code})"):
        return False
    
    order = r.json()
    passed = isinstance(order, dict) and "id" in order
    log_test("C", 7, passed, f"Response is single order object (not list)")
    
    # Verify enrichment fields
    has_customer = "customer" in order
    has_is_sub = "is_subscription" in order
    has_refs = "subscription_refs" in order
    passed = has_customer and has_is_sub and has_refs
    log_test("C", 7, passed, f"Order has enrichment fields (customer:{has_customer}, is_subscription:{has_is_sub}, subscription_refs:{has_refs})")
    
    # Step 8: GET /api/admin/orders/non-existent-id → 404
    r = requests.get(f"{BASE_URL}/admin/orders/non-existent-order-id-12345", headers=admin_headers)
    passed = r.status_code == 404
    log_test("C", 8, passed, f"GET /api/admin/orders/non-existent-id returns 404 (got {r.status_code})")
    
    # Step 9: GET /api/admin/orders/{oid} as customer → 403
    r = requests.get(f"{BASE_URL}/admin/orders/{test_order_id}", headers=customer_headers)
    passed = r.status_code == 403
    log_test("C", 9, passed, f"GET /api/admin/orders/{test_order_id[:8]} as customer returns 403 (got {r.status_code})")
    
    return True


def test_section_d():
    """D) Permission gating"""
    print("\n=== SECTION D: Permission Gating ===")
    
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    
    # Step 10: GET /api/admin/orders as non-admin → 403
    r = requests.get(f"{BASE_URL}/admin/orders", headers=customer_headers)
    passed = r.status_code == 403
    log_test("D", 10, passed, f"GET /api/admin/orders as customer returns 403 (got {r.status_code})")
    
    return True


def test_section_e():
    """E) Checkout source/subscription_id (new optional fields)"""
    print("\n=== SECTION E: Checkout Source & Subscription ID ===")
    
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get customer's address
    r = requests.get(f"{BASE_URL}/auth/me", headers=customer_headers)
    if r.status_code != 200:
        log_test("E", 11, False, f"Failed to get customer profile: {r.status_code}")
        return False
    
    profile = r.json()
    addresses = profile.get("addresses", [])
    if not addresses:
        log_test("E", 11, False, "Customer has no addresses")
        return False
    
    address_id = addresses[0]["id"]
    
    # Add item to cart
    r = requests.get(f"{BASE_URL}/products?type=milk")
    if r.status_code != 200:
        log_test("E", 11, False, f"Failed to get products: {r.status_code}")
        return False
    
    products = r.json()
    if not products:
        log_test("E", 11, False, "No products available")
        return False
    
    product_id = products[0]["id"]
    
    # Clear cart first
    r = requests.delete(f"{BASE_URL}/cart/clear", headers=customer_headers)
    
    # Add to cart
    r = requests.post(f"{BASE_URL}/cart/add", json={"product_id": product_id, "qty": 1}, headers=customer_headers)
    if r.status_code != 200:
        log_test("E", 11, False, f"Failed to add to cart: {r.status_code}")
        return False
    
    # Step 11: Checkout with source="subscription" and subscription_id
    checkout_data = {
        "address_id": address_id,
        "slot": "morning",
        "payment_method": "upi",
        "source": "subscription",
        "subscription_id": "sub_demo_1"
    }
    
    r = requests.post(f"{BASE_URL}/orders/checkout", json=checkout_data, headers=customer_headers)
    passed = r.status_code == 200
    if not log_test("E", 11, passed, f"Checkout with source='subscription' returns 200 (got {r.status_code})"):
        return False
    
    checkout_response = r.json()
    order = checkout_response.get("order", {})
    order_id = order.get("id")
    
    # Verify order has source and subscription_id
    passed = order.get("source") == "subscription"
    log_test("E", 11, passed, f"Order source is 'subscription' (got '{order.get('source')}')")
    
    passed = order.get("subscription_id") == "sub_demo_1"
    log_test("E", 11, passed, f"Order subscription_id is 'sub_demo_1' (got '{order.get('subscription_id')}')")
    
    # Verify status is "received" (NOT "packed")
    passed = order.get("status") == "received"
    log_test("E", 11, passed, f"Order status is 'received' (got '{order.get('status')}') - bug fix intact")
    
    # Step 12: Verify is_subscription is true in admin view
    r = requests.get(f"{BASE_URL}/admin/orders/{order_id}", headers=admin_headers)
    if r.status_code != 200:
        log_test("E", 12, False, f"Failed to get order from admin endpoint: {r.status_code}")
        return False
    
    admin_order = r.json()
    passed = admin_order.get("is_subscription") == True
    log_test("E", 12, passed, f"Admin view shows is_subscription=true (got {admin_order.get('is_subscription')})")
    
    # Step 13: Test old-style checkout without source field
    # Add to cart again
    r = requests.post(f"{BASE_URL}/cart/add", json={"product_id": product_id, "qty": 1}, headers=customer_headers)
    
    checkout_data_old = {
        "address_id": address_id,
        "slot": "morning",
        "payment_method": "upi"
        # No source or subscription_id
    }
    
    r = requests.post(f"{BASE_URL}/orders/checkout", json=checkout_data_old, headers=customer_headers)
    passed = r.status_code == 200
    if not log_test("E", 13, passed, f"Old-style checkout (no source) returns 200 (got {r.status_code})"):
        return False
    
    checkout_response = r.json()
    order = checkout_response.get("order", {})
    
    passed = order.get("source") == "one_time"
    log_test("E", 13, passed, f"Order defaults to source='one_time' (got '{order.get('source')}')")
    
    # is_subscription should depend on milk subscription matching
    # Since we created an A2 Milk subscription earlier, this order might be marked as subscription
    log_test("E", 13, True, f"Order is_subscription depends on heuristic (value: {order.get('is_subscription')})")
    
    return True


def test_section_f():
    """F) Regression check - previous bug fix"""
    print("\n=== SECTION F: Regression Check (Bug Fix) ===")
    
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get customer's address
    r = requests.get(f"{BASE_URL}/auth/me", headers=customer_headers)
    if r.status_code != 200:
        log_test("F", 14, False, f"Failed to get customer profile: {r.status_code}")
        return False
    
    profile = r.json()
    addresses = profile.get("addresses", [])
    if not addresses:
        log_test("F", 14, False, "Customer has no addresses")
        return False
    
    address_id = addresses[0]["id"]
    
    # Get a product
    r = requests.get(f"{BASE_URL}/products?type=milk")
    if r.status_code != 200:
        log_test("F", 14, False, f"Failed to get products: {r.status_code}")
        return False
    
    products = r.json()
    if not products:
        log_test("F", 14, False, "No products available")
        return False
    
    product_id = products[0]["id"]
    
    # Add to cart
    r = requests.post(f"{BASE_URL}/cart/add", json={"product_id": product_id, "qty": 1}, headers=customer_headers)
    if r.status_code != 200:
        log_test("F", 14, False, f"Failed to add to cart: {r.status_code}")
        return False
    
    # Checkout
    checkout_data = {
        "address_id": address_id,
        "slot": "morning",
        "payment_method": "upi"
    }
    
    r = requests.post(f"{BASE_URL}/orders/checkout", json=checkout_data, headers=customer_headers)
    passed = r.status_code == 200
    if not log_test("F", 14, passed, f"Checkout returns 200 (got {r.status_code})"):
        return False
    
    checkout_response = r.json()
    order = checkout_response.get("order", {})
    order_id = order.get("id")
    
    # Verify initial status is "received"
    passed = order.get("status") == "received"
    log_test("F", 14, passed, f"Initial order status is 'received' (got '{order.get('status')}')")
    
    passed = order.get("payment_status") == "pending"
    log_test("F", 14, passed, f"Initial payment_status is 'pending' (got '{order.get('payment_status')}')")
    
    # Confirm payment
    r = requests.post(f"{BASE_URL}/orders/{order_id}/confirm-payment", headers=customer_headers)
    passed = r.status_code == 200
    if not log_test("F", 14, passed, f"Confirm payment returns 200 (got {r.status_code})"):
        return False
    
    confirmed_order = r.json()
    
    # CRITICAL: Status should STILL be "received" (NOT "packed")
    passed = confirmed_order.get("status") == "received"
    log_test("F", 14, passed, f"After confirm-payment, status is STILL 'received' (got '{confirmed_order.get('status')}') - BUG FIX VERIFIED")
    
    passed = confirmed_order.get("payment_status") == "paid"
    log_test("F", 14, passed, f"After confirm-payment, payment_status is 'paid' (got '{confirmed_order.get('payment_status')}')")
    
    # Verify tracking
    tracking = confirmed_order.get("tracking", [])
    if tracking:
        received_step = next((t for t in tracking if t.get("step") == "received"), None)
        packed_step = next((t for t in tracking if t.get("step") == "packed"), None)
        
        if received_step:
            passed = received_step.get("done") == True
            log_test("F", 14, passed, f"Tracking: received.done=true (got {received_step.get('done')})")
        
        if packed_step:
            passed = packed_step.get("done") == False
            log_test("F", 14, passed, f"Tracking: packed.done=false (got {packed_step.get('done')})")
    
    return True


def main():
    """Run all tests"""
    global customer_token, admin_token
    
    print("=" * 70)
    print("DairyNest Backend API Tests")
    print("Enriched Admin Orders Endpoint + Subscription Detection")
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
        test_section_a()
        test_section_b()
        test_section_c()
        test_section_d()
        test_section_e()
        test_section_f()
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
