#!/usr/bin/env python3
"""
Backend API tests for DairyNest - Banners CRUD endpoints
"""
import requests
import json

# Configuration
BASE_URL = "https://readme-guide-9.preview.emergentagent.com/api"
OTP = "123456"
CUSTOMER_PHONE = "9000000001"
ADMIN_PHONE = "6398213389"

# Test state
customer_token = None
admin_token = None
test_results = []
created_banner_ids = []


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
    """A) Public listing"""
    print("\n=== SECTION A: Public Banner Listing ===")
    
    # Step 1: GET /api/banners with no auth → 200, list
    r = requests.get(f"{BASE_URL}/banners")
    passed = r.status_code == 200
    if not log_test("A", 1, passed, f"GET /api/banners returns 200 (got {r.status_code})"):
        return False
    
    banners = r.json()
    passed = isinstance(banners, list)
    if not log_test("A", 1, passed, f"Response is a list (got {type(banners).__name__})"):
        return False
    
    log_test("A", 1, True, f"Public endpoint returns {len(banners)} banner(s)")
    
    # Verify all returned banners have active==true
    if len(banners) > 0:
        all_active = all(b.get("active") == True for b in banners)
        log_test("A", 1, all_active, f"All returned banners have active=true: {all_active}")
    
    return True


def test_section_b():
    """B) Admin CRUD (login as admin)"""
    print("\n=== SECTION B: Admin CRUD Operations ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 2: POST /api/admin/banners - Create banner with base64 image
    banner_data = {
        "title": "Summer Sale",
        "subtitle": "Up to 30% off",
        "image": "data:image/jpeg;base64,/9j/AAA",
        "cta_label": "Shop",
        "cta_route": "/catalog?type=fruit,vegetable",
        "badge": "NEW",
        "active": True,
        "sort_order": 1
    }
    
    r = requests.post(f"{BASE_URL}/admin/banners", json=banner_data, headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("B", 2, passed, f"POST /api/admin/banners returns 200 (got {r.status_code})"):
        print(f"Response: {r.text}")
        return False
    
    created_banner = r.json()
    banner_id = created_banner.get("id")
    created_banner_ids.append(banner_id)
    
    passed = banner_id is not None
    log_test("B", 2, passed, f"Response has id: {banner_id}")
    
    passed = "created_at" in created_banner
    log_test("B", 2, passed, f"Response has created_at: {created_banner.get('created_at')}")
    
    passed = created_banner.get("image") == banner_data["image"]
    log_test("B", 2, passed, f"Image preserved verbatim (base64 data URI)")
    
    passed = created_banner.get("active") == True
    log_test("B", 2, passed, f"Banner active=true (got {created_banner.get('active')})")
    
    # Step 3: GET /api/admin/banners → 200, returns the new banner
    r = requests.get(f"{BASE_URL}/admin/banners", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("B", 3, passed, f"GET /api/admin/banners returns 200 (got {r.status_code})"):
        return False
    
    admin_banners = r.json()
    passed = isinstance(admin_banners, list)
    log_test("B", 3, passed, f"Response is a list with {len(admin_banners)} banner(s)")
    
    found_banner = any(b.get("id") == banner_id for b in admin_banners)
    log_test("B", 3, found_banner, f"New banner found in admin list: {found_banner}")
    
    # Step 4: PUT /api/admin/banners/{id} - Update banner
    update_data = {
        "title": "Updated",
        "subtitle": "New subtitle",
        "image": "https://example.com/x.jpg",
        "cta_label": "Buy",
        "cta_route": "/catalog?type=milk",
        "badge": "HOT",
        "active": True,
        "sort_order": 2
    }
    
    r = requests.put(f"{BASE_URL}/admin/banners/{banner_id}", json=update_data, headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("B", 4, passed, f"PUT /api/admin/banners/{banner_id[:8]} returns 200 (got {r.status_code})"):
        print(f"Response: {r.text}")
        return False
    
    updated_banner = r.json()
    passed = updated_banner.get("title") == "Updated"
    log_test("B", 4, passed, f"Title updated to 'Updated' (got '{updated_banner.get('title')}')")
    
    passed = updated_banner.get("image") == "https://example.com/x.jpg"
    log_test("B", 4, passed, f"Image updated to https URL")
    
    passed = updated_banner.get("sort_order") == 2
    log_test("B", 4, passed, f"sort_order updated to 2 (got {updated_banner.get('sort_order')})")
    
    # Step 5: PUT /api/admin/banners/{id}/toggle → 200, active flipped (now false)
    r = requests.put(f"{BASE_URL}/admin/banners/{banner_id}/toggle", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("B", 5, passed, f"PUT /api/admin/banners/{banner_id[:8]}/toggle returns 200 (got {r.status_code})"):
        return False
    
    toggled_banner = r.json()
    passed = toggled_banner.get("active") == False
    log_test("B", 5, passed, f"Banner active flipped to false (got {toggled_banner.get('active')})")
    
    # Step 6: GET /api/banners (public) → that banner MUST NOT appear (it's inactive)
    r = requests.get(f"{BASE_URL}/banners")
    passed = r.status_code == 200
    if not log_test("B", 6, passed, f"GET /api/banners returns 200 (got {r.status_code})"):
        return False
    
    public_banners = r.json()
    banner_not_in_public = not any(b.get("id") == banner_id for b in public_banners)
    log_test("B", 6, banner_not_in_public, f"Inactive banner NOT in public list: {banner_not_in_public}")
    
    # Step 7: PUT /api/admin/banners/{id}/toggle → 200, active=true again
    r = requests.put(f"{BASE_URL}/admin/banners/{banner_id}/toggle", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("B", 7, passed, f"PUT /api/admin/banners/{banner_id[:8]}/toggle returns 200 (got {r.status_code})"):
        return False
    
    toggled_banner = r.json()
    passed = toggled_banner.get("active") == True
    log_test("B", 7, passed, f"Banner active flipped back to true (got {toggled_banner.get('active')})")
    
    # Step 8: GET /api/banners → that banner now appears
    r = requests.get(f"{BASE_URL}/banners")
    passed = r.status_code == 200
    if not log_test("B", 8, passed, f"GET /api/banners returns 200 (got {r.status_code})"):
        return False
    
    public_banners = r.json()
    banner_in_public = any(b.get("id") == banner_id for b in public_banners)
    log_test("B", 8, banner_in_public, f"Active banner now in public list: {banner_in_public}")
    
    # Step 9: DELETE /api/admin/banners/{id} → 200 {"deleted": true}
    r = requests.delete(f"{BASE_URL}/admin/banners/{banner_id}", headers=admin_headers)
    passed = r.status_code == 200
    if not log_test("B", 9, passed, f"DELETE /api/admin/banners/{banner_id[:8]} returns 200 (got {r.status_code})"):
        return False
    
    delete_response = r.json()
    passed = delete_response.get("deleted") == True
    log_test("B", 9, passed, f"Response has deleted=true (got {delete_response})")
    
    # Step 10: PUT /api/admin/banners/{deleted-id}/toggle should return 404
    r = requests.put(f"{BASE_URL}/admin/banners/{banner_id}/toggle", headers=admin_headers)
    passed = r.status_code == 404
    log_test("B", 10, passed, f"PUT /api/admin/banners/{banner_id[:8]}/toggle (deleted) returns 404 (got {r.status_code})")
    
    return True


def test_section_c():
    """C) Permission gating"""
    print("\n=== SECTION C: Permission Gating ===")
    
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 11: POST /api/admin/banners as customer → 403
    banner_data = {
        "title": "Test",
        "subtitle": "Test",
        "image": "https://example.com/test.jpg",
        "cta_label": "Test",
        "cta_route": "/test",
        "badge": "TEST",
        "active": True,
        "sort_order": 1
    }
    
    r = requests.post(f"{BASE_URL}/admin/banners", json=banner_data, headers=customer_headers)
    passed = r.status_code == 403
    log_test("C", 11, passed, f"POST /api/admin/banners as customer returns 403 (got {r.status_code})")
    
    # Step 12: GET /api/admin/banners as customer → 403
    r = requests.get(f"{BASE_URL}/admin/banners", headers=customer_headers)
    passed = r.status_code == 403
    log_test("C", 12, passed, f"GET /api/admin/banners as customer returns 403 (got {r.status_code})")
    
    # Step 13: DELETE /api/admin/banners/non-existent-id → 404
    r = requests.delete(f"{BASE_URL}/admin/banners/non-existent-banner-id-12345", headers=admin_headers)
    passed = r.status_code == 404
    log_test("C", 13, passed, f"DELETE /api/admin/banners/non-existent-id returns 404 (got {r.status_code})")
    
    return True


def test_section_d():
    """D) Public sorting"""
    print("\n=== SECTION D: Public Sorting ===")
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 14: Create 3 banners with sort_order 5, 1, 10
    banners_to_create = [
        {"title": "Banner A", "subtitle": "Sort 5", "image": "https://example.com/a.jpg", 
         "cta_label": "A", "cta_route": "/a", "badge": "A", "active": True, "sort_order": 5},
        {"title": "Banner B", "subtitle": "Sort 1", "image": "https://example.com/b.jpg", 
         "cta_label": "B", "cta_route": "/b", "badge": "B", "active": True, "sort_order": 1},
        {"title": "Banner C", "subtitle": "Sort 10", "image": "https://example.com/c.jpg", 
         "cta_label": "C", "cta_route": "/c", "badge": "C", "active": True, "sort_order": 10}
    ]
    
    created_ids = []
    for banner_data in banners_to_create:
        r = requests.post(f"{BASE_URL}/admin/banners", json=banner_data, headers=admin_headers)
        if r.status_code == 200:
            banner = r.json()
            created_ids.append(banner.get("id"))
            created_banner_ids.append(banner.get("id"))
    
    passed = len(created_ids) == 3
    log_test("D", 14, passed, f"Created 3 test banners (got {len(created_ids)})")
    
    # GET /api/banners — they should come in order 1, 5, 10
    r = requests.get(f"{BASE_URL}/banners")
    passed = r.status_code == 200
    if not log_test("D", 14, passed, f"GET /api/banners returns 200 (got {r.status_code})"):
        return False
    
    public_banners = r.json()
    
    # Find our test banners in the response
    test_banners = [b for b in public_banners if b.get("id") in created_ids]
    
    if len(test_banners) >= 3:
        sort_orders = [b.get("sort_order") for b in test_banners[:3]]
        expected_order = [1, 5, 10]
        
        # Check if they appear in ascending sort_order
        is_sorted = True
        for i in range(len(test_banners) - 1):
            if test_banners[i].get("sort_order") > test_banners[i+1].get("sort_order"):
                is_sorted = False
                break
        
        log_test("D", 14, is_sorted, f"Banners sorted by sort_order ascending: {[b.get('sort_order') for b in test_banners]}")
    else:
        log_test("D", 14, False, f"Could not find all 3 test banners in public list (found {len(test_banners)})")
    
    return True


def test_section_e():
    """E) Regression — ensure other endpoints still work"""
    print("\n=== SECTION E: Regression Tests ===")
    
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 15: GET /api/products → still works
    r = requests.get(f"{BASE_URL}/products")
    passed = r.status_code == 200
    log_test("E", 15, passed, f"GET /api/products returns 200 (got {r.status_code})")
    
    if passed:
        products = r.json()
        log_test("E", 15, isinstance(products, list), f"Products endpoint returns list with {len(products)} items")
    
    # Step 16: GET /api/admin/orders as admin → still works
    r = requests.get(f"{BASE_URL}/admin/orders", headers=admin_headers)
    passed = r.status_code == 200
    log_test("E", 16, passed, f"GET /api/admin/orders returns 200 (got {r.status_code})")
    
    if passed:
        orders = r.json()
        log_test("E", 16, isinstance(orders, list), f"Admin orders endpoint returns list with {len(orders)} items")
    
    # Step 17: Order placement flow still works (cart add + checkout)
    # Get customer's address
    r = requests.get(f"{BASE_URL}/auth/me", headers=customer_headers)
    if r.status_code != 200:
        log_test("E", 17, False, f"Failed to get customer profile: {r.status_code}")
        return False
    
    profile = r.json()
    addresses = profile.get("addresses", [])
    if not addresses:
        log_test("E", 17, True, "Customer has no addresses (skipping order placement test)")
        return True
    
    address_id = addresses[0]["id"]
    
    # Get a product
    r = requests.get(f"{BASE_URL}/products?type=milk")
    if r.status_code != 200:
        log_test("E", 17, False, f"Failed to get products: {r.status_code}")
        return False
    
    products = r.json()
    if not products:
        log_test("E", 17, False, "No products available")
        return False
    
    product_id = products[0]["id"]
    
    # Add to cart
    r = requests.post(f"{BASE_URL}/cart/add", json={"product_id": product_id, "qty": 1}, headers=customer_headers)
    passed = r.status_code == 200
    log_test("E", 17, passed, f"POST /api/cart/add returns 200 (got {r.status_code})")
    
    # Checkout
    checkout_data = {
        "address_id": address_id,
        "slot": "morning",
        "payment_method": "upi"
    }
    
    r = requests.post(f"{BASE_URL}/orders/checkout", json=checkout_data, headers=customer_headers)
    passed = r.status_code == 200
    log_test("E", 17, passed, f"POST /api/orders/checkout returns 200 (got {r.status_code})")
    
    if passed:
        checkout_response = r.json()
        order = checkout_response.get("order", {})
        log_test("E", 17, "id" in order, f"Order created successfully with id: {order.get('id', 'N/A')[:8]}")
    
    return True


def cleanup():
    """Clean up test banners"""
    print("\n=== Cleanup: Deleting Test Banners ===")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    for banner_id in created_banner_ids:
        r = requests.delete(f"{BASE_URL}/admin/banners/{banner_id}", headers=admin_headers)
        if r.status_code == 200:
            print(f"✓ Deleted banner {banner_id[:8]}")
        else:
            print(f"✗ Failed to delete banner {banner_id[:8]}: {r.status_code}")


def main():
    """Run all tests"""
    global customer_token, admin_token
    
    print("=" * 70)
    print("DairyNest Backend API Tests")
    print("Banners CRUD Endpoints")
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
    except Exception as e:
        print(f"\n❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        if admin_token:
            cleanup()
    
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
