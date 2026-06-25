#!/usr/bin/env python3
"""
Backend API tests for DairyNest v1.6 - Subscription UX Overhaul
Tests commitment_days, customer calendar, end_date enforcement, and startup generation
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
test_subscription_id = None
test_order_id = None


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


def test_commitment_days():
    """Test 1: SubscriptionIn.commitment_days - POST /api/subscriptions with commitment_days"""
    print("\n=== TEST 1: Subscription with commitment_days ===")
    global test_subscription_id
    
    headers = {"Authorization": f"Bearer {customer_token}"}
    
    # Get a milk product
    r = requests.get(f"{BASE_URL}/products?type=milk")
    if not log_test("1", "a", r.status_code == 200, f"GET milk products (status {r.status_code})"):
        return False
    
    products = r.json()
    if not products:
        log_test("1", "a", False, "No milk products available")
        return False
    
    milk_product = products[0]
    log_test("1", "a", True, f"Found milk product: {milk_product.get('name')}")
    
    # Create subscription with commitment_days=7
    today = date.today()
    expected_end_date = (today + timedelta(days=6)).isoformat()
    
    sub_data = {
        "product_id": milk_product["id"],
        "milk_type": "Cow Milk",
        "quantity_label": "1L",
        "quantity_ml": 1000,
        "schedule": "morning",
        "frequency": "daily",
        "commitment_days": 7
    }
    
    r = requests.post(f"{BASE_URL}/subscriptions", json=sub_data, headers=headers)
    if not log_test("1", "b", r.status_code == 200, f"POST /api/subscriptions with commitment_days=7 (status {r.status_code})"):
        if r.status_code != 200:
            print(f"Response: {r.text}")
        return False
    
    subscription = r.json()
    test_subscription_id = subscription.get("id")
    
    # Verify start_date and end_date
    start_date = subscription.get("start_date")
    end_date = subscription.get("end_date")
    
    passed = start_date == today.isoformat()
    log_test("1", "b", passed, f"start_date is today: {start_date} (expected {today.isoformat()})")
    
    passed = end_date == expected_end_date
    log_test("1", "b", passed, f"end_date is today+6: {end_date} (expected {expected_end_date})")
    
    # Verify commitment_days is stored
    passed = subscription.get("commitment_days") == 7
    log_test("1", "b", passed, f"commitment_days stored: {subscription.get('commitment_days')}")
    
    # Check if today's order was auto-generated
    r = requests.get(f"{BASE_URL}/orders", headers=headers)
    if not log_test("1", "d", r.status_code == 200, f"GET /api/orders (status {r.status_code})"):
        return False
    
    orders = r.json()
    
    # Find today's subscription order
    today_order = None
    for order in orders:
        if (order.get("source") == "subscription" and 
            order.get("subscription_id") == test_subscription_id and
            order.get("delivery_date") == today.isoformat()):
            today_order = order
            test_order_id = order.get("id")
            break
    
    if today_order:
        log_test("1", "d", True, f"Today's order auto-generated: {today_order.get('id')[:8]}")
        
        # Verify order attributes
        passed = today_order.get("source") == "subscription"
        log_test("1", "d", passed, f"Order source='subscription' (got '{today_order.get('source')}')")
        
        passed = today_order.get("payment_method") == "autopay"
        log_test("1", "d", passed, f"Order payment_method='autopay' (got '{today_order.get('payment_method')}')")
        
        passed = today_order.get("payment_status") == "paid"
        log_test("1", "d", passed, f"Order payment_status='paid' (got '{today_order.get('payment_status')}')")
        
        passed = today_order.get("status") == "received"
        log_test("1", "d", passed, f"Order status='received' (got '{today_order.get('status')}')")
    else:
        log_test("1", "d", False, "Today's order NOT found (should be auto-generated)")
    
    return True


def test_customer_calendar():
    """Test 2: Customer subscription calendar - GET /api/subscriptions/{sid}/calendar"""
    print("\n=== TEST 2: Customer Subscription Calendar ===")
    
    if not test_subscription_id:
        log_test("2", "a", False, "No test subscription ID (skipping calendar test)")
        return False
    
    headers = {"Authorization": f"Bearer {customer_token}"}
    
    # Test default range (no params)
    r = requests.get(f"{BASE_URL}/subscriptions/{test_subscription_id}/calendar", headers=headers)
    if not log_test("2", "a", r.status_code == 200, f"GET calendar (default range) status {r.status_code}"):
        if r.status_code != 200:
            print(f"Response: {r.text}")
        return False
    
    calendar = r.json()
    
    # Verify response structure
    required_fields = ["subscription", "from", "to", "expected_time", "delivered_count", "upcoming_count", "days"]
    missing = [f for f in required_fields if f not in calendar]
    log_test("2", "a", len(missing) == 0, f"Calendar has all required fields (missing: {missing})")
    
    # Verify expected_time format (should be like "06:00–10:00" for morning)
    expected_time = calendar.get("expected_time", "")
    passed = "–" in expected_time or ":" in expected_time
    log_test("2", "a", passed, f"expected_time format: '{expected_time}'")
    
    # Verify upcoming_count
    upcoming_count = calendar.get("upcoming_count", 0)
    passed = upcoming_count >= 6  # Should have at least 6 upcoming days (today + 6 future days for 7-day commitment)
    log_test("2", "a", passed, f"upcoming_count >= 6 (got {upcoming_count})")
    
    # Verify days array
    days = calendar.get("days", [])
    passed = len(days) > 0
    log_test("2", "a", passed, f"days array has {len(days)} entries")
    
    # Find today's entry
    today = date.today().isoformat()
    today_entry = None
    for day in days:
        if day.get("date") == today:
            today_entry = day
            break
    
    if today_entry:
        log_test("2", "a", True, f"Found today's entry: {today}")
        
        # Verify today's entry attributes
        passed = today_entry.get("status") == "today"
        log_test("2", "a", passed, f"Today status='today' (got '{today_entry.get('status')}')")
        
        passed = today_entry.get("is_due") == True
        log_test("2", "a", passed, f"Today is_due=true (got {today_entry.get('is_due')})")
        
        # Should have order_id since we created today's order
        passed = today_entry.get("order_id") is not None
        log_test("2", "a", passed, f"Today has order_id: {today_entry.get('order_id', 'None')[:8] if today_entry.get('order_id') else 'None'}")
    else:
        log_test("2", "a", False, "Today's entry NOT found in calendar")
    
    # Check days beyond end_date (should be out_of_range)
    end_date = calendar.get("subscription", {}).get("end_date")
    if end_date:
        end_date_obj = date.fromisoformat(end_date)
        beyond_end = (end_date_obj + timedelta(days=1)).isoformat()
        
        beyond_entry = None
        for day in days:
            if day.get("date") == beyond_end:
                beyond_entry = day
                break
        
        if beyond_entry:
            passed = beyond_entry.get("status") == "out_of_range"
            log_test("2", "a", passed, f"Day after end_date status='out_of_range' (got '{beyond_entry.get('status')}')")
            
            passed = beyond_entry.get("is_due") == False
            log_test("2", "a", passed, f"Day after end_date is_due=false (got {beyond_entry.get('is_due')})")
    
    # Test explicit date range
    date_from = date.today().isoformat()
    date_to = (date.today() + timedelta(days=3)).isoformat()
    
    r = requests.get(f"{BASE_URL}/subscriptions/{test_subscription_id}/calendar?date_from={date_from}&date_to={date_to}", headers=headers)
    passed = r.status_code == 200
    log_test("2", "b", passed, f"GET calendar with explicit range (status {r.status_code})")
    
    if passed:
        calendar2 = r.json()
        days2 = calendar2.get("days", [])
        expected_days = 4  # today + 3 days
        passed = len(days2) == expected_days
        log_test("2", "b", passed, f"Explicit range returns {len(days2)} days (expected {expected_days})")
    
    return True


def test_calendar_ownership():
    """Test 2c: Calendar ownership - admin cannot access customer's calendar"""
    print("\n=== TEST 2c: Calendar Ownership ===")
    
    if not test_subscription_id:
        log_test("2", "c", False, "No test subscription ID (skipping ownership test)")
        return False
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Admin tries to access customer's subscription calendar
    r = requests.get(f"{BASE_URL}/subscriptions/{test_subscription_id}/calendar", headers=admin_headers)
    passed = r.status_code == 404
    log_test("2", "c", passed, f"Admin accessing customer calendar returns 404 (got {r.status_code})")
    
    return True


def test_end_date_enforcement():
    """Test 3: End-date enforcement - _sub_is_due_on respects end_date"""
    print("\n=== TEST 3: End-date Enforcement ===")
    
    if not test_subscription_id:
        log_test("3", "a", False, "No test subscription ID (skipping end-date test)")
        return False
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test admin calendar for dates beyond commitment (today+10)
    # The 7-day subscription should NOT appear, but other subscriptions (30-day, open-ended) may appear
    future_date = (date.today() + timedelta(days=10)).isoformat()
    
    r = requests.get(f"{BASE_URL}/admin/subscriptions/calendar?date_from={future_date}&date_to={future_date}", headers=admin_headers)
    if not log_test("3", "b", r.status_code == 200, f"GET admin calendar (status {r.status_code})"):
        if r.status_code != 200:
            print(f"Response: {r.text}")
        return False
    
    admin_calendar = r.json()
    dates = admin_calendar.get("dates", [])
    
    # Verify our 7-day subscription is NOT in the list (it should be excluded)
    if dates:
        day = dates[0]
        deliveries = day.get("deliveries", [])
        found_7day_sub = False
        for delivery in deliveries:
            if delivery.get("subscription_id") == test_subscription_id:
                found_7day_sub = True
                break
        
        passed = not found_7day_sub
        log_test("3", "b", passed, f"7-day subscription correctly excluded from date beyond end_date (found={found_7day_sub})")
    else:
        log_test("3", "b", False, "No dates returned from admin calendar")
    
    # Test generate-daily for date beyond commitment
    # Get count of orders before generation
    r = requests.get(f"{BASE_URL}/orders", headers={"Authorization": f"Bearer {customer_token}"})
    orders_before = len(r.json()) if r.status_code == 200 else 0
    
    r = requests.post(f"{BASE_URL}/admin/subscriptions/generate-daily?date_str={future_date}", headers=admin_headers)
    if not log_test("3", "c", r.status_code == 200, f"POST generate-daily for future date (status {r.status_code})"):
        if r.status_code != 200:
            print(f"Response: {r.text}")
        return False
    
    result = r.json()
    created = result.get("created", -1)
    
    # The 7-day subscription should NOT create an order (out of commitment)
    # But other subscriptions may create orders, so we just verify the call succeeded
    log_test("3", "c", True, f"generate-daily executed: created={created}, skipped={result.get('skipped', 0)}")
    
    # Verify no order was created for our 7-day subscription on this future date
    r = requests.get(f"{BASE_URL}/orders", headers={"Authorization": f"Bearer {customer_token}"})
    if r.status_code == 200:
        orders = r.json()
        found_7day_order = False
        for order in orders:
            if (order.get("subscription_id") == test_subscription_id and 
                order.get("delivery_date") == future_date):
                found_7day_order = True
                break
        
        passed = not found_7day_order
        log_test("3", "c", passed, f"No order created for 7-day subscription on date beyond commitment (found={found_7day_order})")
    
    return True


def test_permissions():
    """Test 5: Permissions - calendar requires auth and ownership"""
    print("\n=== TEST 5: Permissions ===")
    
    if not test_subscription_id:
        log_test("5", "a", False, "No test subscription ID (skipping permissions test)")
        return False
    
    # Test without auth
    r = requests.get(f"{BASE_URL}/subscriptions/{test_subscription_id}/calendar")
    passed = r.status_code == 401
    log_test("5", "a", passed, f"Calendar without auth returns 401 (got {r.status_code})")
    
    # Already tested ownership in test_calendar_ownership (admin accessing customer's calendar)
    log_test("5", "b", True, "Ownership test completed in section 2c")
    
    return True


def test_regression():
    """Test 6: Regression - earlier v1.5 features still work"""
    print("\n=== TEST 6: Regression Tests ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test first-order discount (from v1.5)
    r = requests.get(f"{BASE_URL}/settings")
    passed = r.status_code == 200
    log_test("6", "1", passed, f"GET /api/settings (status {r.status_code})")
    
    if passed:
        settings = r.json()
        has_discount = "first_order_discount_enabled" in settings
        log_test("6", "1", has_discount, f"Settings has first_order_discount fields")
    
    # Test inventory decrement endpoint exists
    r = requests.get(f"{BASE_URL}/products?type=milk")
    passed = r.status_code == 200
    log_test("6", "2", passed, f"GET /api/products (status {r.status_code})")
    
    # Test admin orders filters
    r = requests.get(f"{BASE_URL}/admin/orders?kind=subscription", headers=admin_headers)
    passed = r.status_code == 200
    log_test("6", "3", passed, f"GET /api/admin/orders?kind=subscription (status {r.status_code})")
    
    # Test admin subscriptions calendar
    today_str = date.today().isoformat()
    tomorrow_str = (date.today() + timedelta(days=1)).isoformat()
    r = requests.get(f"{BASE_URL}/admin/subscriptions/calendar?date_from={today_str}&date_to={tomorrow_str}", headers=admin_headers)
    passed = r.status_code == 200
    log_test("6", "4", passed, f"GET /api/admin/subscriptions/calendar (status {r.status_code})")
    
    # Test generate-daily idempotency
    r = requests.post(f"{BASE_URL}/admin/subscriptions/generate-daily?date_str={today_str}", headers=admin_headers)
    passed = r.status_code == 200
    log_test("6", "5", passed, f"POST /api/admin/subscriptions/generate-daily (status {r.status_code})")
    
    if passed:
        result = r.json()
        # Should be idempotent (skipped >= 1 since we already created today's order)
        skipped = result.get("skipped", 0)
        passed = skipped >= 1
        log_test("6", "5", passed, f"generate-daily idempotent: skipped={skipped}")
    
    # Test product stock-status endpoint
    r = requests.get(f"{BASE_URL}/products?type=milk")
    if r.status_code == 200:
        products = r.json()
        if products:
            pid = products[0]["id"]
            r = requests.put(f"{BASE_URL}/admin/products/{pid}/stock-status", 
                           json={"out_of_stock": False}, 
                           headers=admin_headers)
            passed = r.status_code == 200
            log_test("6", "6", passed, f"PUT /api/admin/products/{{pid}}/stock-status (status {r.status_code})")
    
    # Test expanded settings
    r = requests.get(f"{BASE_URL}/admin/settings", headers=admin_headers)
    passed = r.status_code == 200
    log_test("6", "7", passed, f"GET /api/admin/settings (status {r.status_code})")
    
    if passed:
        settings = r.json()
        has_windows = "morning_window_start" in settings
        log_test("6", "7", has_windows, f"Settings has delivery window fields")
        
        has_referral = "referral_trigger" in settings
        log_test("6", "7", has_referral, f"Settings has referral trigger fields")
    
    return True


def test_commitment_30_days():
    """Test 1c: Create subscription with commitment_days=30"""
    print("\n=== TEST 1c: Subscription with commitment_days=30 ===")
    
    headers = {"Authorization": f"Bearer {customer_token}"}
    
    # Get a milk product
    r = requests.get(f"{BASE_URL}/products?type=milk")
    if r.status_code != 200:
        log_test("1", "c", False, f"Failed to get milk products: {r.status_code}")
        return False
    
    products = r.json()
    if not products:
        log_test("1", "c", False, "No milk products available")
        return False
    
    milk_product = products[0]
    
    # Create subscription with commitment_days=30
    today = date.today()
    expected_end_date = (today + timedelta(days=29)).isoformat()
    
    sub_data = {
        "product_id": milk_product["id"],
        "milk_type": "Buffalo Milk",
        "quantity_label": "500ml",
        "quantity_ml": 500,
        "schedule": "evening",
        "frequency": "daily",
        "commitment_days": 30
    }
    
    r = requests.post(f"{BASE_URL}/subscriptions", json=sub_data, headers=headers)
    if not log_test("1", "c", r.status_code == 200, f"POST subscription with commitment_days=30 (status {r.status_code})"):
        return False
    
    subscription = r.json()
    
    # Verify end_date
    end_date = subscription.get("end_date")
    passed = end_date == expected_end_date
    log_test("1", "c", passed, f"end_date is today+29: {end_date} (expected {expected_end_date})")
    
    return True


def main():
    """Run all v1.6 tests"""
    global customer_token, admin_token
    
    print("=" * 70)
    print("DairyNest Backend API Tests - v1.6 Subscription UX Overhaul")
    print("=" * 70)
    
    # Login
    print("\n=== Authentication ===")
    customer_token = login(CUSTOMER_PHONE, "Customer")
    admin_token = login(ADMIN_PHONE, "Admin")
    
    if not customer_token or not admin_token:
        print("\n❌ FAILED: Could not authenticate")
        return
    
    # Run tests in sequence
    try:
        test_commitment_days()
        test_commitment_30_days()
        test_customer_calendar()
        test_calendar_ownership()
        test_end_date_enforcement()
        test_permissions()
        test_regression()
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
        print("\n❌ FAILED TESTS:")
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
