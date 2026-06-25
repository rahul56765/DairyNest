#!/usr/bin/env python3
"""
Backend API test suite for DairyNest bug fix verification.
Tests the critical bug fix: orders should stay in "received" status after payment,
not automatically jump to "packed".
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://system-blueprint-22.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
CUSTOMER_PHONE = "9000000001"
ADMIN_PHONE = "6398213389"
OTP_CODE = "123456"

# Global state
tokens = {}
user_data = {}
test_results = []


def log_test(step: str, description: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{step}: {status} - {description}"
    if details:
        result += f"\n  Details: {details}"
    print(result)
    test_results.append({
        "step": step,
        "description": description,
        "passed": passed,
        "details": details
    })


def login(phone: str, role_name: str) -> Optional[str]:
    """Login and return JWT token"""
    # Send OTP
    resp = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": phone})
    if resp.status_code != 200:
        print(f"❌ Failed to send OTP for {role_name}: {resp.status_code}")
        return None
    
    # Verify OTP
    resp = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone, "code": OTP_CODE})
    if resp.status_code != 200:
        print(f"❌ Failed to verify OTP for {role_name}: {resp.status_code}")
        return None
    
    data = resp.json()
    if not data.get("registered"):
        print(f"❌ {role_name} not registered in database")
        return None
    
    token = data.get("token")
    user = data.get("user")
    tokens[role_name] = token
    user_data[role_name] = user
    print(f"✓ Logged in as {role_name}: {user.get('name')} (ID: {user.get('id')})")
    return token


def get_headers(role: str) -> Dict[str, str]:
    """Get authorization headers for a role"""
    return {
        "Authorization": f"Bearer {tokens[role]}",
        "Content-Type": "application/json"
    }


def test_bug_fix_order_status():
    """Test A: BUG FIX — order stays in 'received' until admin packs it [CRITICAL]"""
    print("\n" + "="*80)
    print("TEST A: BUG FIX — ORDER STAYS IN 'RECEIVED' UNTIL ADMIN PACKS IT")
    print("="*80)
    
    # Step 1: Login as customer (already done in main)
    log_test("A.1", "Login as customer 9000000001", True, f"User: {user_data['customer'].get('name')}")
    
    # Step 2: Get a product and add to cart
    resp = requests.get(f"{BASE_URL}/products", headers=get_headers("customer"))
    products = resp.json()
    if not products:
        log_test("A.2", "Get products for cart", False, "No products available")
        return None
    
    product_id = products[0]["id"]
    resp = requests.post(
        f"{BASE_URL}/cart/add",
        headers=get_headers("customer"),
        json={"product_id": product_id, "qty": 1}
    )
    passed = resp.status_code == 200
    log_test("A.2", "POST /api/cart/add", passed, 
             f"Status: {resp.status_code}, Product: {products[0].get('name')}")
    
    if not passed:
        return None
    
    # Step 3: Checkout order
    customer = user_data["customer"]
    address_id = customer.get("default_address_id")
    resp = requests.post(
        f"{BASE_URL}/orders/checkout",
        headers=get_headers("customer"),
        json={"address_id": address_id, "slot": "morning", "payment_method": "upi"}
    )
    
    if resp.status_code != 200:
        log_test("A.3", "POST /api/orders/checkout", False, 
                f"Status: {resp.status_code}, Response: {resp.text}")
        return None
    
    checkout_data = resp.json()
    order = checkout_data.get("order")
    order_id = order["id"]
    
    passed = (order.get("status") == "received" and 
              order.get("payment_status") == "pending")
    log_test("A.3", "POST /api/orders/checkout", passed,
             f"Status: {resp.status_code}, Order ID: {order_id}, "
             f"order.status={order.get('status')}, payment_status={order.get('payment_status')}")
    
    if not passed:
        return None
    
    # Step 4: Confirm payment - CRITICAL TEST
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/confirm-payment",
        headers=get_headers("customer")
    )
    
    if resp.status_code != 200:
        log_test("A.4", "POST /api/orders/{order_id}/confirm-payment", False,
                f"Status: {resp.status_code}, Response: {resp.text}")
        return None
    
    confirmed_order = resp.json()
    
    # CRITICAL ASSERTION: status must be "received", NOT "packed"
    status_correct = confirmed_order.get("status") == "received"
    payment_correct = confirmed_order.get("payment_status") == "paid"
    
    tracking = confirmed_order.get("tracking", [])
    tracking_correct = False
    if len(tracking) >= 2:
        received_step = next((t for t in tracking if t.get("step") == "received"), None)
        packed_step = next((t for t in tracking if t.get("step") == "packed"), None)
        tracking_correct = (received_step and received_step.get("done") == True and
                          packed_step and packed_step.get("done") == False)
    
    passed = status_correct and payment_correct and tracking_correct
    log_test("A.4", "POST /api/orders/{order_id}/confirm-payment - CRITICAL", passed,
             f"Status: {resp.status_code}, order.status={confirmed_order.get('status')} (MUST be 'received'), "
             f"payment_status={confirmed_order.get('payment_status')} (MUST be 'paid'), "
             f"tracking[0].done={tracking[0].get('done') if tracking else None}, "
             f"tracking[1].done={tracking[1].get('done') if len(tracking) > 1 else None}")
    
    if not passed:
        print(f"  ⚠️  BUG NOT FIXED: Order status is '{confirmed_order.get('status')}' instead of 'received'")
        return None
    
    # Step 5: GET order to verify status persists
    resp = requests.get(f"{BASE_URL}/orders/{order_id}", headers=get_headers("customer"))
    order_check = resp.json()
    passed = resp.status_code == 200 and order_check.get("status") == "received"
    log_test("A.5", "GET /api/orders/{order_id} - status still 'received'", passed,
             f"Status: {resp.status_code}, order.status={order_check.get('status')}")
    
    # Step 6: Login as admin and check received orders
    log_test("A.6", "Login as admin 6398213389", True, f"User: {user_data['admin'].get('name')}")
    
    resp = requests.get(f"{BASE_URL}/admin/orders?status=received", headers=get_headers("admin"))
    received_orders = resp.json()
    order_in_list = any(o.get("id") == order_id for o in received_orders)
    passed = resp.status_code == 200 and order_in_list
    log_test("A.6", "GET /api/admin/orders?status=received - order MUST be present", passed,
             f"Status: {resp.status_code}, Order found: {order_in_list}, "
             f"Total received orders: {len(received_orders)}")
    
    if not passed:
        print(f"  ⚠️  REGRESSION: Order {order_id} not in 'Received' tab (was the original bug)")
    
    # Step 7: Admin updates order status to "packed"
    resp = requests.put(
        f"{BASE_URL}/admin/orders/{order_id}/status",
        headers=get_headers("admin"),
        json={"status": "packed"}
    )
    packed_order = resp.json()
    passed = resp.status_code == 200 and packed_order.get("status") == "packed"
    log_test("A.7", "PUT /api/admin/orders/{order_id}/status to 'packed'", passed,
             f"Status: {resp.status_code}, order.status={packed_order.get('status')}")
    
    # Step 8: Verify order appears in packed list
    resp = requests.get(f"{BASE_URL}/admin/orders?status=packed", headers=get_headers("admin"))
    packed_orders = resp.json()
    order_in_packed = any(o.get("id") == order_id for o in packed_orders)
    passed = resp.status_code == 200 and order_in_packed
    log_test("A.8", "GET /api/admin/orders?status=packed - order present", passed,
             f"Status: {resp.status_code}, Order found: {order_in_packed}")
    
    # Step 9: Verify order NOT in received list anymore
    resp = requests.get(f"{BASE_URL}/admin/orders?status=received", headers=get_headers("admin"))
    received_orders = resp.json()
    order_not_in_received = not any(o.get("id") == order_id for o in received_orders)
    passed = resp.status_code == 200 and order_not_in_received
    log_test("A.9", "GET /api/admin/orders?status=received - order NOT present", passed,
             f"Status: {resp.status_code}, Order found: {not order_not_in_received}")
    
    return order_id


def test_app_settings():
    """Test B: App settings endpoints"""
    print("\n" + "="*80)
    print("TEST B: APP SETTINGS ENDPOINTS")
    print("="*80)
    
    # Step 10: GET /api/settings (public)
    resp = requests.get(f"{BASE_URL}/settings")
    settings = resp.json()
    required_keys = ["first_order_discount_enabled", "first_order_discount_percent", 
                     "first_order_discount_max", "subscription_first_amount", 
                     "subscription_pricing_mode"]
    has_keys = all(k in settings for k in required_keys)
    passed = resp.status_code == 200 and has_keys
    log_test("B.10", "GET /api/settings (public)", passed,
             f"Status: {resp.status_code}, Keys present: {has_keys}, Settings: {json.dumps(settings, indent=2)}")
    
    # Step 11: GET /api/admin/settings as customer (should be 403)
    resp = requests.get(f"{BASE_URL}/admin/settings", headers=get_headers("customer"))
    passed = resp.status_code == 403
    log_test("B.11", "GET /api/admin/settings as customer - 403", passed,
             f"Status: {resp.status_code}")
    
    # Step 12: GET /api/admin/settings as admin (should be 200)
    resp = requests.get(f"{BASE_URL}/admin/settings", headers=get_headers("admin"))
    admin_settings = resp.json()
    has_all_keys = all(k in admin_settings for k in required_keys + 
                       ["subscription_regular_flat_amount", "min_order_for_first_discount"])
    passed = resp.status_code == 200 and has_all_keys
    log_test("B.12", "GET /api/admin/settings as admin - 200 with all fields", passed,
             f"Status: {resp.status_code}, All keys present: {has_all_keys}")
    
    # Step 13: PUT /api/admin/settings with valid data
    resp = requests.put(
        f"{BASE_URL}/admin/settings",
        headers=get_headers("admin"),
        json={"first_order_discount_percent": 25, "first_order_discount_max": 150}
    )
    updated_settings = resp.json()
    values_correct = (updated_settings.get("first_order_discount_percent") == 25 and
                     updated_settings.get("first_order_discount_max") == 150)
    passed = resp.status_code == 200 and values_correct
    log_test("B.13", "PUT /api/admin/settings with valid data", passed,
             f"Status: {resp.status_code}, Values updated: {values_correct}, "
             f"percent={updated_settings.get('first_order_discount_percent')}, "
             f"max={updated_settings.get('first_order_discount_max')}")
    
    # Verify persistence
    resp = requests.get(f"{BASE_URL}/admin/settings", headers=get_headers("admin"))
    persisted = resp.json()
    values_persisted = (persisted.get("first_order_discount_percent") == 25 and
                       persisted.get("first_order_discount_max") == 150)
    passed = values_persisted
    log_test("B.13", "Settings persisted correctly", passed,
             f"Persisted values: percent={persisted.get('first_order_discount_percent')}, "
             f"max={persisted.get('first_order_discount_max')}")
    
    # Step 14: PUT /api/admin/settings with invalid subscription_pricing_mode
    resp = requests.put(
        f"{BASE_URL}/admin/settings",
        headers=get_headers("admin"),
        json={"subscription_pricing_mode": "bogus"}
    )
    passed = resp.status_code == 400
    log_test("B.14", "PUT /api/admin/settings with invalid pricing_mode - 400", passed,
             f"Status: {resp.status_code}, Response: {resp.json()}")


def test_first_order_discount():
    """Test C: First-order discount in checkout"""
    print("\n" + "="*80)
    print("TEST C: FIRST-ORDER DISCOUNT IN CHECKOUT")
    print("="*80)
    
    # First, restore settings to known state
    requests.put(
        f"{BASE_URL}/admin/settings",
        headers=get_headers("admin"),
        json={
            "first_order_discount_enabled": True,
            "first_order_discount_percent": 20,
            "first_order_discount_max": 100
        }
    )
    
    # Step 15: Create a new customer with fresh phone
    import time
    new_phone = f"91234{int(time.time()) % 100000:05d}"  # Generate unique phone
    resp = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": new_phone})
    resp = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": new_phone, "code": OTP_CODE})
    
    if resp.status_code != 200:
        log_test("C.15", "Create new customer", False, f"Status: {resp.status_code}, Response: {resp.text}")
        return
    
    verify_data = resp.json()
    
    # If not registered, complete registration
    if not verify_data.get("registered"):
        resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "phone": new_phone,
                "name": "Test Customer 1",
                "role": "customer",
                "apartment": "Test Apartment",
                "flat": "1A",
                "floor": "1",
                "landmark": "Near Test Mall",
                "lat": 19.0760,
                "lng": 72.8777
            }
        )
        if resp.status_code != 200:
            log_test("C.15", "Register new customer", False, f"Status: {resp.status_code}, Response: {resp.text}")
            return
        new_user_data = resp.json()
    else:
        new_user_data = verify_data
    
    new_token = new_user_data.get("token")
    new_user = new_user_data.get("user")
    
    if not new_user or not new_token:
        log_test("C.15", "Create new customer", False,
                f"Response: {new_user_data}")
        return
    
    passed = new_token is not None
    log_test("C.15", f"Create new customer with phone {new_phone}", passed,
             f"User ID: {new_user.get('id')}")
    
    if not passed:
        return
    
    new_headers = {
        "Authorization": f"Bearer {new_token}",
        "Content-Type": "application/json"
    }
    
    # Step 16: Add address for new customer
    resp = requests.post(
        f"{BASE_URL}/addresses",
        headers=new_headers,
        json={"label": "Home", "apartment": "Test Apartment", "flat": "1A", "is_default": True}
    )
    
    if resp.status_code != 200:
        log_test("C.16", "Add address for new customer", False, f"Status: {resp.status_code}")
        return
    
    updated_user = resp.json()
    address_id = updated_user.get("default_address_id")
    log_test("C.16", "Add address for new customer", True, f"Address ID: {address_id}")
    
    # Step 17: Add product to cart
    resp = requests.get(f"{BASE_URL}/products", headers=new_headers)
    products = resp.json()
    if not products:
        log_test("C.17", "Get products", False, "No products available")
        return
    
    product_id = products[0]["id"]
    resp = requests.post(
        f"{BASE_URL}/cart/add",
        headers=new_headers,
        json={"product_id": product_id, "qty": 2}
    )
    log_test("C.17", "Add product to cart", resp.status_code == 200, f"Status: {resp.status_code}")
    
    # Step 18: Checkout and verify first_order_bonus
    resp = requests.post(
        f"{BASE_URL}/orders/checkout",
        headers=new_headers,
        json={"address_id": address_id, "slot": "morning", "payment_method": "upi"}
    )
    
    if resp.status_code != 200:
        log_test("C.18", "Checkout with first-order discount", False,
                f"Status: {resp.status_code}, Response: {resp.text}")
        return
    
    checkout_data = resp.json()
    first_order_bonus = checkout_data.get("first_order_bonus", 0)
    order = checkout_data.get("order")
    
    bonus_applied = first_order_bonus > 0
    order_bonus_matches = order.get("first_order_bonus") == first_order_bonus
    discount_includes_bonus = order.get("discount") >= first_order_bonus
    
    passed = bonus_applied and order_bonus_matches and discount_includes_bonus
    log_test("C.18", "Checkout applies first-order discount", passed,
             f"Status: {resp.status_code}, first_order_bonus={first_order_bonus}, "
             f"order.first_order_bonus={order.get('first_order_bonus')}, "
             f"order.discount={order.get('discount')}, order.amount={order.get('amount')}")
    
    first_order_id = order["id"]
    
    # Step 19: Confirm payment so order counts as paid
    resp = requests.post(f"{BASE_URL}/orders/{first_order_id}/confirm-payment", headers=new_headers)
    log_test("C.19", "Confirm payment for first order", resp.status_code == 200,
             f"Status: {resp.status_code}")
    
    # Step 20: Add another product and checkout again (should NOT get discount)
    resp = requests.post(
        f"{BASE_URL}/cart/add",
        headers=new_headers,
        json={"product_id": product_id, "qty": 1}
    )
    
    resp = requests.post(
        f"{BASE_URL}/orders/checkout",
        headers=new_headers,
        json={"address_id": address_id, "slot": "morning", "payment_method": "upi"}
    )
    
    if resp.status_code != 200:
        log_test("C.20", "Second checkout - no repeat discount", False,
                f"Status: {resp.status_code}, Response: {resp.text}")
    else:
        checkout_data2 = resp.json()
        second_bonus = checkout_data2.get("first_order_bonus", 0)
        passed = second_bonus == 0
        log_test("C.20", "Second checkout - no repeat discount", passed,
                f"Status: {resp.status_code}, first_order_bonus={second_bonus} (MUST be 0)")
    
    # Step 21: Admin disables first-order discount
    resp = requests.put(
        f"{BASE_URL}/admin/settings",
        headers=get_headers("admin"),
        json={"first_order_discount_enabled": False}
    )
    log_test("C.21", "Admin disables first-order discount", resp.status_code == 200,
             f"Status: {resp.status_code}")
    
    # Step 22: Create ANOTHER new customer and verify no discount
    new_phone2 = f"91234{int(time.time()) % 100000:05d}"  # Generate unique phone
    resp = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": new_phone2})
    resp = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": new_phone2, "code": OTP_CODE})
    
    if resp.status_code != 200:
        log_test("C.22", "Create another new customer", False, f"Status: {resp.status_code}")
        return
    
    verify_data2 = resp.json()
    
    # If not registered, complete registration
    if not verify_data2.get("registered"):
        resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "phone": new_phone2,
                "name": "Test Customer 2",
                "role": "customer",
                "apartment": "Test Apartment 2",
                "flat": "2B",
                "floor": "2",
                "landmark": "Near Test Park",
                "lat": 19.0760,
                "lng": 72.8777
            }
        )
        if resp.status_code != 200:
            log_test("C.22", "Register another new customer", False, f"Status: {resp.status_code}")
            return
        new_user_data2 = resp.json()
    else:
        new_user_data2 = verify_data2
    
    new_token2 = new_user_data2.get("token")
    new_headers2 = {
        "Authorization": f"Bearer {new_token2}",
        "Content-Type": "application/json"
    }
    
    # Get address from user
    updated_user2 = new_user_data2.get("user")
    address_id2 = updated_user2.get("default_address_id")
    
    # Add product and checkout
    resp = requests.post(
        f"{BASE_URL}/cart/add",
        headers=new_headers2,
        json={"product_id": product_id, "qty": 1}
    )
    
    resp = requests.post(
        f"{BASE_URL}/orders/checkout",
        headers=new_headers2,
        json={"address_id": address_id2, "slot": "morning", "payment_method": "upi"}
    )
    
    if resp.status_code != 200:
        log_test("C.22", "Checkout with discount disabled", False,
                f"Status: {resp.status_code}, Response: {resp.text}")
    else:
        checkout_data3 = resp.json()
        bonus_disabled = checkout_data3.get("first_order_bonus", 0)
        passed = bonus_disabled == 0
        log_test("C.22", "Checkout with discount disabled - no bonus", passed,
                f"Status: {resp.status_code}, first_order_bonus={bonus_disabled} (MUST be 0)")
    
    # Step 23: Restore settings
    resp = requests.put(
        f"{BASE_URL}/admin/settings",
        headers=get_headers("admin"),
        json={
            "first_order_discount_enabled": True,
            "first_order_discount_percent": 20,
            "first_order_discount_max": 100
        }
    )
    log_test("C.23", "Restore first-order discount settings", resp.status_code == 200,
             f"Status: {resp.status_code}")


def test_multi_type_filter():
    """Test D: Multi-type product filter"""
    print("\n" + "="*80)
    print("TEST D: MULTI-TYPE PRODUCT FILTER")
    print("="*80)
    
    # Step 24: GET /api/products?type=fruit,vegetable
    resp = requests.get(f"{BASE_URL}/products?type=fruit,vegetable")
    products = resp.json()
    
    # Verify all products are either fruit or vegetable
    all_correct_type = all(p.get("type") in ["fruit", "vegetable"] for p in products)
    passed = resp.status_code == 200 and all_correct_type and len(products) > 0
    log_test("D.24", "GET /api/products?type=fruit,vegetable", passed,
             f"Status: {resp.status_code}, Count: {len(products)}, "
             f"All correct type: {all_correct_type}, "
             f"Types found: {set(p.get('type') for p in products)}")
    
    # Step 25: GET /api/products/categories?type=fruit,vegetable
    resp = requests.get(f"{BASE_URL}/products/categories?type=fruit,vegetable")
    categories = resp.json()
    passed = resp.status_code == 200 and isinstance(categories, list) and len(categories) > 0
    log_test("D.25", "GET /api/products/categories?type=fruit,vegetable", passed,
             f"Status: {resp.status_code}, Categories: {categories}")
    
    # Step 26: GET /api/products?type=milk (single type, backward compat)
    resp = requests.get(f"{BASE_URL}/products?type=milk")
    milk_products = resp.json()
    all_milk = all(p.get("type") == "milk" for p in milk_products)
    passed = resp.status_code == 200 and all_milk and len(milk_products) > 0
    log_test("D.26", "GET /api/products?type=milk (backward compat)", passed,
             f"Status: {resp.status_code}, Count: {len(milk_products)}, All milk: {all_milk}")


def test_payments_config():
    """Test E: Payments config"""
    print("\n" + "="*80)
    print("TEST E: PAYMENTS CONFIG")
    print("="*80)
    
    # Step 27: GET /api/payments/config
    resp = requests.get(f"{BASE_URL}/payments/config")
    config = resp.json()
    
    has_required_keys = all(k in config for k in ["razorpay_live", "razorpay_key_id", "currency"])
    expected_values = (config.get("razorpay_live") == False and
                      config.get("razorpay_key_id") is None and
                      config.get("currency") == "INR")
    
    passed = resp.status_code == 200 and has_required_keys and expected_values
    log_test("E.27", "GET /api/payments/config", passed,
             f"Status: {resp.status_code}, Config: {json.dumps(config, indent=2)}")


def main():
    """Main test runner"""
    print("="*80)
    print("DAIRYNEST BACKEND API TEST SUITE")
    print("Bug Fix Verification: Order Status Flow")
    print("="*80)
    
    # Login test users
    print("\n--- Logging in test users ---")
    if not login(CUSTOMER_PHONE, "customer"):
        print("❌ Failed to login customer. Aborting tests.")
        sys.exit(1)
    
    if not login(ADMIN_PHONE, "admin"):
        print("❌ Failed to login admin. Aborting tests.")
        sys.exit(1)
    
    # Run test suites
    try:
        test_bug_fix_order_status()
        test_app_settings()
        test_first_order_discount()
        test_multi_type_filter()
        test_payments_config()
    except Exception as e:
        print(f"\n❌ Test suite failed with exception: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    
    print(f"Total tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for r in test_results:
            if not r["passed"]:
                print(f"  - {r['step']}: {r['description']}")
                if r["details"]:
                    print(f"    {r['details']}")
    else:
        print("\n✅ ALL TESTS PASSED!")
    
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
