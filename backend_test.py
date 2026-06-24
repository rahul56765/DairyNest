#!/usr/bin/env python3
"""
Backend API test suite for DairyNest push notifications bug fix verification.
Tests push token registration, notification history, admin broadcast, and auto-push on order events.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://wonderful-feynman-7.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
CUSTOMER_PHONE = "9000000001"
AGENT_PHONE = "9000000002"
ADMIN_PHONE = "6398213389"
MANAGER_PHONE = "9000000004"
OTP_CODE = "123456"

# Global state
tokens = {}
user_data = {}
test_results = []


def log_test(step: int, description: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"Step {step}: {status} - {description}"
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


def test_push_registration():
    """Test A: Push token registration"""
    print("\n" + "="*80)
    print("TEST A: PUSH TOKEN REGISTRATION")
    print("="*80)
    
    # Step 1: Register valid token
    token_value = "ExponentPushToken[test-customer-001]"
    resp = requests.post(
        f"{BASE_URL}/push/register",
        headers=get_headers("customer"),
        json={"token": token_value, "platform": "android"}
    )
    passed = resp.status_code == 200 and resp.json().get("status") == "registered"
    log_test(1, "POST /api/push/register with valid token", passed, 
             f"Status: {resp.status_code}, Response: {resp.json()}")
    
    # Step 2: Verify token in user profile
    resp = requests.get(f"{BASE_URL}/auth/me", headers=get_headers("customer"))
    push_tokens = resp.json().get("push_tokens", [])
    passed = resp.status_code == 200 and token_value in push_tokens
    log_test(2, "GET /api/auth/me shows registered token", passed,
             f"push_tokens: {push_tokens}")
    
    # Step 3: Register invalid token format
    resp = requests.post(
        f"{BASE_URL}/push/register",
        headers=get_headers("customer"),
        json={"token": "badformat", "platform": "android"}
    )
    data = resp.json()
    passed = (resp.status_code == 200 and 
              data.get("status") == "skipped" and 
              data.get("reason") == "invalid_token_format")
    log_test(3, "POST /api/push/register with invalid token format", passed,
             f"Status: {resp.status_code}, Response: {data}")
    
    # Verify push_tokens unchanged
    resp = requests.get(f"{BASE_URL}/auth/me", headers=get_headers("customer"))
    new_tokens = resp.json().get("push_tokens", [])
    passed = "badformat" not in new_tokens
    log_test(3, "Invalid token not added to push_tokens", passed,
             f"push_tokens: {new_tokens}")
    
    # Step 4: Register same token again (idempotent)
    resp = requests.post(
        f"{BASE_URL}/push/register",
        headers=get_headers("customer"),
        json={"token": token_value, "platform": "android"}
    )
    resp2 = requests.get(f"{BASE_URL}/auth/me", headers=get_headers("customer"))
    final_tokens = resp2.json().get("push_tokens", [])
    count = final_tokens.count(token_value)
    passed = count == 1
    log_test(4, "Duplicate token registration is idempotent", passed,
             f"Token count: {count}, push_tokens: {final_tokens}")
    
    # Step 5: Unregister token
    resp = requests.post(
        f"{BASE_URL}/push/unregister",
        headers=get_headers("customer"),
        json={"token": token_value}
    )
    passed = resp.status_code == 200 and resp.json().get("status") == "unregistered"
    log_test(5, "POST /api/push/unregister", passed,
             f"Status: {resp.status_code}, Response: {resp.json()}")
    
    # Verify token removed
    resp = requests.get(f"{BASE_URL}/auth/me", headers=get_headers("customer"))
    final_tokens = resp.json().get("push_tokens", [])
    passed = token_value not in final_tokens
    log_test(5, "Token removed from push_tokens", passed,
             f"push_tokens: {final_tokens}")


def test_notification_history():
    """Test B: Notification history endpoints"""
    print("\n" + "="*80)
    print("TEST B: NOTIFICATION HISTORY ENDPOINTS")
    print("="*80)
    
    # Step 6: GET /api/notifications
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    passed = resp.status_code == 200 and isinstance(resp.json(), list)
    log_test(6, "GET /api/notifications", passed,
             f"Status: {resp.status_code}, Count: {len(resp.json())}")
    
    # Step 7: PUT /api/notifications/read-all
    resp = requests.put(f"{BASE_URL}/notifications/read-all", headers=get_headers("customer"))
    passed = resp.status_code == 200 and resp.json().get("status") == "ok"
    log_test(7, "PUT /api/notifications/read-all", passed,
             f"Status: {resp.status_code}, Response: {resp.json()}")


def test_admin_broadcast():
    """Test C: Admin broadcast"""
    print("\n" + "="*80)
    print("TEST C: ADMIN BROADCAST")
    print("="*80)
    
    # Re-register customer push token for broadcast test
    requests.post(
        f"{BASE_URL}/push/register",
        headers=get_headers("customer"),
        json={"token": "ExponentPushToken[test-customer-001]", "platform": "android"}
    )
    
    # Step 8: Admin broadcast to customers
    resp = requests.post(
        f"{BASE_URL}/admin/push/broadcast",
        headers=get_headers("admin"),
        json={"title": "Hello", "body": "Test msg", "target": "customer"}
    )
    data = resp.json()
    passed = resp.status_code == 200 and data.get("recipients", 0) >= 1
    log_test(8, "POST /api/admin/push/broadcast target=customer", passed,
             f"Status: {resp.status_code}, sent: {data.get('sent')}, recipients: {data.get('recipients')}")
    
    # Step 9: Invalid target
    resp = requests.post(
        f"{BASE_URL}/admin/push/broadcast",
        headers=get_headers("admin"),
        json={"title": "X", "body": "Y", "target": "bogus"}
    )
    passed = resp.status_code == 400
    log_test(9, "POST /api/admin/push/broadcast with invalid target", passed,
             f"Status: {resp.status_code}, Response: {resp.json()}")
    
    # Step 10: Broadcast to all
    resp = requests.post(
        f"{BASE_URL}/admin/push/broadcast",
        headers=get_headers("admin"),
        json={"title": "Z", "body": "Q", "target": "all"}
    )
    data = resp.json()
    passed = resp.status_code == 200 and data.get("recipients", 0) >= 1
    log_test(10, "POST /api/admin/push/broadcast target=all", passed,
             f"Status: {resp.status_code}, recipients: {data.get('recipients')}")
    
    # Step 11: Targeted broadcast with user_ids
    customer_id = user_data["customer"]["id"]
    resp = requests.post(
        f"{BASE_URL}/admin/push/broadcast",
        headers=get_headers("admin"),
        json={"title": "Direct", "body": "You only", "target": "all", "user_ids": [customer_id]}
    )
    data = resp.json()
    passed = resp.status_code == 200 and data.get("recipients") == 1
    log_test(11, "POST /api/admin/push/broadcast with user_ids", passed,
             f"Status: {resp.status_code}, recipients: {data.get('recipients')}")
    
    # Step 12: Verify broadcast notification in customer history
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    notifications = resp.json()
    broadcast_notif = next((n for n in notifications if n.get("title") == "Hello" and 
                           n.get("body") == "Test msg" and 
                           n.get("data", {}).get("kind") == "broadcast"), None)
    passed = broadcast_notif is not None
    log_test(12, "Broadcast notification appears in customer history", passed,
             f"Found: {broadcast_notif is not None}, Notification: {broadcast_notif}")


def test_permission_gating():
    """Test D: Permission gating on broadcast"""
    print("\n" + "="*80)
    print("TEST D: PERMISSION GATING ON BROADCAST")
    print("="*80)
    
    # Step 13: Customer tries to broadcast (should fail)
    resp = requests.post(
        f"{BASE_URL}/admin/push/broadcast",
        headers=get_headers("customer"),
        json={"title": "x", "body": "y", "target": "all"}
    )
    passed = resp.status_code == 403
    log_test(13, "Customer cannot broadcast (403)", passed,
             f"Status: {resp.status_code}")
    
    # Step 14: Manager without marketing permission tries to broadcast
    resp = requests.post(
        f"{BASE_URL}/admin/push/broadcast",
        headers=get_headers("manager"),
        json={"title": "x", "body": "y", "target": "all"}
    )
    passed = resp.status_code == 403
    log_test(14, "Manager without marketing permission cannot broadcast (403)", passed,
             f"Status: {resp.status_code}")
    
    # Step 15: Admin grants marketing permission to manager
    manager_id = user_data["manager"]["id"]
    resp = requests.put(
        f"{BASE_URL}/admin/managers/{manager_id}/permissions",
        headers=get_headers("admin"),
        json={"permissions": {
            "customers": True,
            "orders": True,
            "inventory": True,
            "support": True,
            "marketing": True
        }}
    )
    passed = resp.status_code == 200
    log_test(15, "Admin grants marketing permission to manager", passed,
             f"Status: {resp.status_code}")
    
    # Step 16: Manager with marketing permission can now broadcast
    # Need to re-login to get new token with updated permissions
    login(MANAGER_PHONE, "manager")
    resp = requests.post(
        f"{BASE_URL}/admin/push/broadcast",
        headers=get_headers("manager"),
        json={"title": "FromMgr", "body": "hey", "target": "customer"}
    )
    passed = resp.status_code == 200
    log_test(16, "Manager with marketing permission can broadcast", passed,
             f"Status: {resp.status_code}, Response: {resp.json()}")


def test_order_auto_push():
    """Test E: Auto-push on order events"""
    print("\n" + "="*80)
    print("TEST E: AUTO-PUSH ON ORDER EVENTS")
    print("="*80)
    
    # Step 17: Add item to cart
    resp = requests.get(f"{BASE_URL}/products", headers=get_headers("customer"))
    products = resp.json()
    if not products:
        log_test(17, "No products available for testing", False, "Cannot proceed with order tests")
        return
    
    product_id = products[0]["id"]
    resp = requests.post(
        f"{BASE_URL}/cart/add",
        headers=get_headers("customer"),
        json={"product_id": product_id, "qty": 1}
    )
    passed = resp.status_code == 200
    log_test(17, "Add product to cart", passed,
             f"Status: {resp.status_code}, Product: {product_id}")
    
    # Step 18: Checkout order
    customer = user_data["customer"]
    address_id = customer.get("default_address_id")
    resp = requests.post(
        f"{BASE_URL}/orders/checkout",
        headers=get_headers("customer"),
        json={"address_id": address_id, "slot": "morning", "payment_method": "cod"}
    )
    if resp.status_code != 200:
        log_test(18, "Checkout order", False, f"Status: {resp.status_code}, Response: {resp.text}")
        return
    
    order = resp.json().get("order")
    order_id = order["id"]
    passed = resp.status_code == 200
    log_test(18, "POST /api/orders/checkout", passed,
             f"Status: {resp.status_code}, Order ID: {order_id}")
    
    # Step 19: Verify "Order Placed" notification
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    notifications = resp.json()
    order_placed = next((n for n in notifications if "Order Placed" in n.get("title", "") and
                        n.get("data", {}).get("order_id") == order_id), None)
    passed = order_placed is not None
    log_test(19, "Order Placed notification present", passed,
             f"Found: {order_placed is not None}")
    
    # Step 20: Confirm payment
    resp = requests.post(
        f"{BASE_URL}/orders/{order_id}/confirm-payment",
        headers=get_headers("customer")
    )
    passed = resp.status_code == 200
    log_test(20, "POST /api/orders/{order_id}/confirm-payment", passed,
             f"Status: {resp.status_code}")
    
    # Verify "Payment Confirmed" notification
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    notifications = resp.json()
    payment_confirmed = next((n for n in notifications if "Payment Confirmed" in n.get("title", "")), None)
    passed = payment_confirmed is not None
    log_test(20, "Payment Confirmed notification present", passed,
             f"Found: {payment_confirmed is not None}")
    
    # Step 21: Admin updates order status to "packed"
    resp = requests.put(
        f"{BASE_URL}/admin/orders/{order_id}/status",
        headers=get_headers("admin"),
        json={"status": "packed"}
    )
    passed = resp.status_code == 200
    log_test(21, "Admin updates order status to packed", passed,
             f"Status: {resp.status_code}")
    
    # Verify "Order Packed" notification
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    notifications = resp.json()
    order_packed = next((n for n in notifications if "Order Packed" in n.get("title", "")), None)
    passed = order_packed is not None
    log_test(21, "Order Packed notification present", passed,
             f"Found: {order_packed is not None}")
    
    # Step 22: Admin updates order status to "out_for_delivery"
    resp = requests.put(
        f"{BASE_URL}/admin/orders/{order_id}/status",
        headers=get_headers("admin"),
        json={"status": "out_for_delivery"}
    )
    passed = resp.status_code == 200
    log_test(22, "Admin updates order status to out_for_delivery", passed,
             f"Status: {resp.status_code}")
    
    # Verify "Out for Delivery" notification
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    notifications = resp.json()
    out_for_delivery = next((n for n in notifications if "Out for Delivery" in n.get("title", "")), None)
    passed = out_for_delivery is not None
    log_test(22, "Out for Delivery notification present", passed,
             f"Found: {out_for_delivery is not None}")
    
    # Step 23: Admin assigns order to agent
    agent_id = user_data["agent"]["id"]
    resp = requests.put(
        f"{BASE_URL}/admin/orders/{order_id}/assign",
        headers=get_headers("admin"),
        params={"agent_id": agent_id}
    )
    passed = resp.status_code == 200
    log_test(23, "Admin assigns order to agent", passed,
             f"Status: {resp.status_code}")
    
    # Verify customer gets "Out for Delivery" notification
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    notifications = resp.json()
    # Count "Out for Delivery" notifications (should have at least 2 now)
    out_for_delivery_count = sum(1 for n in notifications if "Out for Delivery" in n.get("title", ""))
    passed = out_for_delivery_count >= 2
    log_test(23, "Customer gets another Out for Delivery notification", passed,
             f"Count: {out_for_delivery_count}")
    
    # Verify agent gets "New Delivery Assigned" notification
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("agent"))
    agent_notifications = resp.json()
    new_delivery = next((n for n in agent_notifications if "New Delivery Assigned" in n.get("title", "") and
                        n.get("data", {}).get("order_id") == order_id), None)
    passed = new_delivery is not None
    log_test(23, "Agent gets New Delivery Assigned notification", passed,
             f"Found: {new_delivery is not None}")
    
    # Step 24: Agent marks order as delivered
    resp = requests.post(
        f"{BASE_URL}/agent/delivery/{order_id}/status",
        headers=get_headers("agent"),
        json={"status": "delivered", "otp": "1234", "photo": "photo_url", "note": "Delivered successfully"}
    )
    passed = resp.status_code == 200
    log_test(24, "Agent marks order as delivered", passed,
             f"Status: {resp.status_code}")
    
    # Verify customer gets "Order Delivered" notification
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    notifications = resp.json()
    order_delivered = next((n for n in notifications if "Order Delivered" in n.get("title", "")), None)
    passed = order_delivered is not None
    log_test(24, "Order Delivered notification present", passed,
             f"Found: {order_delivered is not None}")
    
    # Step 25: Admin marks order as failed
    # First, create a new order for this test
    resp = requests.post(
        f"{BASE_URL}/cart/add",
        headers=get_headers("customer"),
        json={"product_id": product_id, "qty": 1}
    )
    resp = requests.post(
        f"{BASE_URL}/orders/checkout",
        headers=get_headers("customer"),
        json={"address_id": address_id, "slot": "morning", "payment_method": "cod"}
    )
    order2 = resp.json().get("order")
    order2_id = order2["id"]
    
    resp = requests.put(
        f"{BASE_URL}/admin/orders/{order2_id}/status",
        headers=get_headers("admin"),
        json={"status": "failed"}
    )
    passed = resp.status_code == 200
    log_test(25, "Admin marks order as failed", passed,
             f"Status: {resp.status_code}")
    
    # Verify customer gets "Delivery Failed" notification
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers("customer"))
    notifications = resp.json()
    delivery_failed = next((n for n in notifications if "Delivery Failed" in n.get("title", "") or
                           "failed" in n.get("title", "").lower()), None)
    passed = delivery_failed is not None
    log_test(25, "Delivery Failed notification present", passed,
             f"Found: {delivery_failed is not None}")


def main():
    """Main test runner"""
    print("="*80)
    print("DAIRYNEST BACKEND API TEST SUITE")
    print("Push Notifications Bug Fix Verification")
    print("="*80)
    
    # Login all test users
    print("\n--- Logging in test users ---")
    if not login(CUSTOMER_PHONE, "customer"):
        print("❌ Failed to login customer. Aborting tests.")
        sys.exit(1)
    
    if not login(AGENT_PHONE, "agent"):
        print("❌ Failed to login agent. Aborting tests.")
        sys.exit(1)
    
    if not login(ADMIN_PHONE, "admin"):
        print("❌ Failed to login admin. Aborting tests.")
        sys.exit(1)
    
    if not login(MANAGER_PHONE, "manager"):
        print("❌ Failed to login manager. Aborting tests.")
        sys.exit(1)
    
    # Run test suites
    try:
        test_push_registration()
        test_notification_history()
        test_admin_broadcast()
        test_permission_gating()
        test_order_auto_push()
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
        print("\nFailed tests:")
        for r in test_results:
            if not r["passed"]:
                print(f"  - Step {r['step']}: {r['description']}")
                if r["details"]:
                    print(f"    {r['details']}")
    
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
