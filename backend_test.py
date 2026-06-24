#!/usr/bin/env python3
"""
DairyNest Backend API Testing Suite
Tests admin management & permissions endpoints
"""

import requests
import json
import sys
import time
from typing import Dict, Optional, Tuple

# Backend URL from frontend/.env
BASE_URL = "https://858e0403-4a1e-47ea-804c-c1dbeb83325d.preview.emergentagent.com/api"

# Test credentials (OTP: 123456 for all)
CREDENTIALS = {
    "customer": "9000000001",
    "agent": "9000000002",
    "admin": "6398213389",
    "manager": "9000000004",  # permissions: customers, orders, inventory, support
}

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.failures = []
    
    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"{GREEN}✓{RESET} {test_name}")
    
    def add_fail(self, test_name: str, reason: str, url: str = "", status: int = 0, response: str = ""):
        self.failed += 1
        self.failures.append({
            "test": test_name,
            "reason": reason,
            "url": url,
            "status": status,
            "response": response
        })
        print(f"{RED}✗{RESET} {test_name}")
        print(f"  {RED}Reason:{RESET} {reason}")
        if url:
            print(f"  {YELLOW}URL:{RESET} {url}")
        if status:
            print(f"  {YELLOW}Status:{RESET} {status}")
        if response:
            print(f"  {YELLOW}Response:{RESET} {response[:500]}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"Test Summary: {self.passed}/{total} passed")
        if self.failed > 0:
            print(f"\n{RED}Failed Tests:{RESET}")
            for f in self.failures:
                print(f"  • {f['test']}: {f['reason']}")
        print(f"{'='*60}\n")
        return self.failed == 0


def login(phone: str) -> Optional[str]:
    """Login and return JWT token"""
    try:
        # Send OTP
        resp = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": phone}, timeout=10)
        if resp.status_code != 200:
            print(f"{RED}Failed to send OTP for {phone}: {resp.status_code}{RESET}")
            return None
        
        # Verify OTP (dev fallback: 123456)
        resp = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone, "code": "123456"}, timeout=10)
        if resp.status_code != 200:
            print(f"{RED}Failed to verify OTP for {phone}: {resp.status_code}{RESET}")
            return None
        
        data = resp.json()
        if not data.get("token"):
            print(f"{RED}No token in response for {phone}{RESET}")
            return None
        
        return data["token"]
    except Exception as e:
        print(f"{RED}Login error for {phone}: {e}{RESET}")
        return None


def make_request(method: str, endpoint: str, token: str, json_data: Optional[Dict] = None, 
                 params: Optional[Dict] = None) -> Tuple[int, Dict]:
    """Make authenticated API request"""
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=10)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=json_data, timeout=10)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=10)
        else:
            return 0, {"error": "Invalid method"}
        
        try:
            return resp.status_code, resp.json()
        except:
            return resp.status_code, {"text": resp.text}
    except Exception as e:
        return 0, {"error": str(e)}


def test_coupon_endpoints(admin_token: str, result: TestResult):
    """Test coupon admin endpoints"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing Coupon Admin Endpoints{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # 1. GET /api/admin/coupons - list
    status, data = make_request("GET", "/admin/coupons", admin_token)
    if status == 200 and isinstance(data, list):
        result.add_pass("GET /api/admin/coupons - list coupons")
    else:
        result.add_fail("GET /api/admin/coupons - list coupons", 
                       f"Expected 200 with list, got {status}", 
                       f"{BASE_URL}/admin/coupons", status, json.dumps(data))
    
    # 2. POST /api/admin/coupons - create
    coupon_data = {
        "code": "testcoup",
        "type": "percent",
        "value": 15,
        "min_order": 50,
        "max_discount": 100
    }
    status, data = make_request("POST", "/admin/coupons", admin_token, coupon_data)
    if status == 200 and data.get("code") == "TESTCOUP":  # should be uppercased
        result.add_pass("POST /api/admin/coupons - create coupon (code uppercased)")
    else:
        result.add_fail("POST /api/admin/coupons - create coupon", 
                       f"Expected 200 with code=TESTCOUP, got {status}", 
                       f"{BASE_URL}/admin/coupons", status, json.dumps(data))
    
    # 3. PUT /api/admin/coupons/TESTCOUP/toggle - deactivate
    status, data = make_request("PUT", "/admin/coupons/TESTCOUP/toggle", admin_token)
    if status == 200 and data.get("active") == False:
        result.add_pass("PUT /api/admin/coupons/TESTCOUP/toggle - deactivate")
    else:
        result.add_fail("PUT /api/admin/coupons/TESTCOUP/toggle - deactivate", 
                       f"Expected 200 with active=false, got {status}", 
                       f"{BASE_URL}/admin/coupons/TESTCOUP/toggle", status, json.dumps(data))
    
    # 4. PUT /api/admin/coupons/TESTCOUP/toggle - reactivate
    status, data = make_request("PUT", "/admin/coupons/TESTCOUP/toggle", admin_token)
    if status == 200 and data.get("active") == True:
        result.add_pass("PUT /api/admin/coupons/TESTCOUP/toggle - reactivate")
    else:
        result.add_fail("PUT /api/admin/coupons/TESTCOUP/toggle - reactivate", 
                       f"Expected 200 with active=true, got {status}", 
                       f"{BASE_URL}/admin/coupons/TESTCOUP/toggle", status, json.dumps(data))
    
    # 5. DELETE /api/admin/coupons/TESTCOUP
    status, data = make_request("DELETE", "/admin/coupons/TESTCOUP", admin_token)
    if status == 200 and data.get("status") == "deleted":
        result.add_pass("DELETE /api/admin/coupons/TESTCOUP - delete coupon")
    else:
        result.add_fail("DELETE /api/admin/coupons/TESTCOUP - delete coupon", 
                       f"Expected 200 with status=deleted, got {status}", 
                       f"{BASE_URL}/admin/coupons/TESTCOUP", status, json.dumps(data))
    
    # 6. GET /api/admin/coupons - verify TESTCOUP is gone
    status, data = make_request("GET", "/admin/coupons", admin_token)
    if status == 200 and isinstance(data, list):
        testcoup_exists = any(c.get("code") == "TESTCOUP" for c in data)
        if not testcoup_exists:
            result.add_pass("GET /api/admin/coupons - verify TESTCOUP deleted")
        else:
            result.add_fail("GET /api/admin/coupons - verify TESTCOUP deleted", 
                           "TESTCOUP still exists after deletion", 
                           f"{BASE_URL}/admin/coupons", status, json.dumps(data))
    else:
        result.add_fail("GET /api/admin/coupons - verify TESTCOUP deleted", 
                       f"Expected 200 with list, got {status}", 
                       f"{BASE_URL}/admin/coupons", status, json.dumps(data))
    
    # 7. PUT /api/admin/coupons/NOPE/toggle - 404 for non-existent
    status, data = make_request("PUT", "/admin/coupons/NOPE/toggle", admin_token)
    if status == 404:
        result.add_pass("PUT /api/admin/coupons/NOPE/toggle - 404 for non-existent")
    else:
        result.add_fail("PUT /api/admin/coupons/NOPE/toggle - 404 for non-existent", 
                       f"Expected 404, got {status}", 
                       f"{BASE_URL}/admin/coupons/NOPE/toggle", status, json.dumps(data))


def test_agent_endpoints(admin_token: str, result: TestResult):
    """Test agent admin endpoints"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing Agent Admin Endpoints{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # Generate unique phone number using timestamp
    unique_phone = f"99999{int(time.time()) % 100000:05d}"
    
    # 1. POST /api/admin/agents - create agent
    agent_data = {
        "name": "Test Agent",
        "phone": unique_phone
    }
    status, data = make_request("POST", "/admin/agents", admin_token, agent_data)
    agent_id = None
    if status == 200 and data.get("name") == "Test Agent" and data.get("employee_id"):
        agent_id = data.get("id")
        result.add_pass("POST /api/admin/agents - create agent with auto employee_id")
    else:
        result.add_fail("POST /api/admin/agents - create agent", 
                       f"Expected 200 with agent data, got {status}", 
                       f"{BASE_URL}/admin/agents", status, json.dumps(data))
    
    # 2. GET /api/admin/agents - verify new agent appears
    status, data = make_request("GET", "/admin/agents", admin_token)
    if status == 200 and isinstance(data, list):
        test_agent = next((a for a in data if a.get("phone") == unique_phone), None)
        if test_agent:
            result.add_pass("GET /api/admin/agents - verify new agent appears")
        else:
            result.add_fail("GET /api/admin/agents - verify new agent appears", 
                           "Test agent not found in list", 
                           f"{BASE_URL}/admin/agents", status, json.dumps(data))
    else:
        result.add_fail("GET /api/admin/agents - verify new agent appears", 
                       f"Expected 200 with list, got {status}", 
                       f"{BASE_URL}/admin/agents", status, json.dumps(data))
    
    if agent_id:
        # 3. PUT /api/admin/agents/{aid}/toggle - suspend
        status, data = make_request("PUT", f"/admin/agents/{agent_id}/toggle", admin_token)
        if status == 200 and data.get("suspended") == True:
            result.add_pass(f"PUT /api/admin/agents/{agent_id}/toggle - suspend agent")
        else:
            result.add_fail(f"PUT /api/admin/agents/{agent_id}/toggle - suspend agent", 
                           f"Expected 200 with suspended=true, got {status}", 
                           f"{BASE_URL}/admin/agents/{agent_id}/toggle", status, json.dumps(data))
        
        # 4. PUT /api/admin/agents/{aid}/toggle - unsuspend
        status, data = make_request("PUT", f"/admin/agents/{agent_id}/toggle", admin_token)
        if status == 200 and data.get("suspended") == False:
            result.add_pass(f"PUT /api/admin/agents/{agent_id}/toggle - unsuspend agent")
        else:
            result.add_fail(f"PUT /api/admin/agents/{agent_id}/toggle - unsuspend agent", 
                           f"Expected 200 with suspended=false, got {status}", 
                           f"{BASE_URL}/admin/agents/{agent_id}/toggle", status, json.dumps(data))
    
    # 5. POST /api/admin/agents - duplicate phone (should fail)
    dup_agent_data = {
        "name": "Dup",
        "phone": unique_phone
    }
    status, data = make_request("POST", "/admin/agents", admin_token, dup_agent_data)
    if status == 400:
        result.add_pass("POST /api/admin/agents - 400 for duplicate phone")
    else:
        result.add_fail("POST /api/admin/agents - 400 for duplicate phone", 
                       f"Expected 400, got {status}", 
                       f"{BASE_URL}/admin/agents", status, json.dumps(data))


def test_manager_endpoints(admin_token: str, result: TestResult):
    """Test manager admin endpoints"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing Manager Admin Endpoints{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # 1. GET /api/admin/managers - list
    status, data = make_request("GET", "/admin/managers", admin_token)
    if status == 200 and isinstance(data, list):
        # Check if Manager Mary exists
        mary = next((m for m in data if m.get("name") == "Manager Mary"), None)
        if mary:
            result.add_pass("GET /api/admin/managers - list (Manager Mary found)")
        else:
            result.add_pass("GET /api/admin/managers - list (no Manager Mary, but endpoint works)")
    else:
        result.add_fail("GET /api/admin/managers - list", 
                       f"Expected 200 with list, got {status}", 
                       f"{BASE_URL}/admin/managers", status, json.dumps(data))
    
    # Generate unique phone number using timestamp
    unique_phone = f"99998{int(time.time()) % 100000:05d}"
    
    # 2. POST /api/admin/managers - create manager
    manager_data = {
        "name": "Test Mgr",
        "phone": unique_phone,
        "permissions": {
            "customers": True,
            "orders": False,
            "inventory": True
        }
    }
    status, data = make_request("POST", "/admin/managers", admin_token, manager_data)
    manager_id = None
    if status == 200 and data.get("name") == "Test Mgr":
        manager_id = data.get("id")
        result.add_pass("POST /api/admin/managers - create manager with permissions")
    else:
        result.add_fail("POST /api/admin/managers - create manager", 
                       f"Expected 200 with manager data, got {status}", 
                       f"{BASE_URL}/admin/managers", status, json.dumps(data))
    
    if manager_id:
        # 3. PUT /api/admin/managers/{mid}/permissions - update permissions
        perm_data = {
            "permissions": {
                "customers": False,
                "products": True,
                "marketing": True
            }
        }
        status, data = make_request("PUT", f"/admin/managers/{manager_id}/permissions", admin_token, perm_data)
        if status == 200 and data.get("permissions", {}).get("products") == True:
            result.add_pass(f"PUT /api/admin/managers/{manager_id}/permissions - update permissions")
        else:
            result.add_fail(f"PUT /api/admin/managers/{manager_id}/permissions - update permissions", 
                           f"Expected 200 with updated permissions, got {status}", 
                           f"{BASE_URL}/admin/managers/{manager_id}/permissions", status, json.dumps(data))
        
        # 4. PUT /api/admin/managers/{mid}/toggle - suspend
        status, data = make_request("PUT", f"/admin/managers/{manager_id}/toggle", admin_token)
        if status == 200 and data.get("suspended") == True:
            result.add_pass(f"PUT /api/admin/managers/{manager_id}/toggle - suspend manager")
        else:
            result.add_fail(f"PUT /api/admin/managers/{manager_id}/toggle - suspend manager", 
                           f"Expected 200 with suspended=true, got {status}", 
                           f"{BASE_URL}/admin/managers/{manager_id}/toggle", status, json.dumps(data))


def test_permission_gating(manager_token: str, result: TestResult):
    """Test permission gating for manager role"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing Permission Gating (Manager Role){RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # Manager should NOT access admin-only endpoints
    
    # 1. GET /api/admin/managers - should be 403
    status, data = make_request("GET", "/admin/managers", manager_token)
    if status == 403:
        result.add_pass("GET /api/admin/managers - 403 for manager (admin-only)")
    else:
        result.add_fail("GET /api/admin/managers - 403 for manager", 
                       f"Expected 403, got {status}", 
                       f"{BASE_URL}/admin/managers", status, json.dumps(data))
    
    # 2. POST /api/admin/managers - should be 403
    status, data = make_request("POST", "/admin/managers", manager_token, {"name": "Test", "phone": "9999999999"})
    if status == 403:
        result.add_pass("POST /api/admin/managers - 403 for manager (admin-only)")
    else:
        result.add_fail("POST /api/admin/managers - 403 for manager", 
                       f"Expected 403, got {status}", 
                       f"{BASE_URL}/admin/managers", status, json.dumps(data))
    
    # 3. POST /api/admin/agents - should be 403
    status, data = make_request("POST", "/admin/agents", manager_token, {"name": "Test", "phone": "9999999999"})
    if status == 403:
        result.add_pass("POST /api/admin/agents - 403 for manager (admin-only)")
    else:
        result.add_fail("POST /api/admin/agents - 403 for manager", 
                       f"Expected 403, got {status}", 
                       f"{BASE_URL}/admin/agents", status, json.dumps(data))
    
    # Manager SHOULD access endpoints they have permission for
    # Manager 9000000004 has: customers, orders, inventory, support
    
    # 4. GET /api/admin/customers - should be 200 (has 'customers' permission)
    status, data = make_request("GET", "/admin/customers", manager_token)
    if status == 200 and isinstance(data, list):
        result.add_pass("GET /api/admin/customers - 200 for manager (has 'customers' permission)")
    else:
        result.add_fail("GET /api/admin/customers - 200 for manager", 
                       f"Expected 200 with list, got {status}", 
                       f"{BASE_URL}/admin/customers", status, json.dumps(data))
    
    # 5. GET /api/admin/inventory - should be 200 (has 'inventory' permission)
    status, data = make_request("GET", "/admin/inventory", manager_token)
    if status == 200 and data.get("items") is not None:
        result.add_pass("GET /api/admin/inventory - 200 for manager (has 'inventory' permission)")
    else:
        result.add_fail("GET /api/admin/inventory - 200 for manager", 
                       f"Expected 200 with items, got {status}", 
                       f"{BASE_URL}/admin/inventory", status, json.dumps(data))
    
    # 6. PUT /api/admin/inventory/{pid}/stock - should be 200 (has 'inventory' permission)
    # First get a product ID
    status, products = make_request("GET", "/products", manager_token)
    if status == 200 and isinstance(products, list) and len(products) > 0:
        pid = products[0].get("id")
        # Pass stock as query parameter
        status, data = make_request("PUT", f"/admin/inventory/{pid}/stock?stock=42", manager_token)
        if status == 200:
            result.add_pass(f"PUT /api/admin/inventory/{pid}/stock - 200 for manager (has 'inventory' permission)")
        else:
            result.add_fail(f"PUT /api/admin/inventory/{pid}/stock - 200 for manager", 
                           f"Expected 200, got {status}", 
                           f"{BASE_URL}/admin/inventory/{pid}/stock?stock=42", status, json.dumps(data))
    else:
        result.add_fail("PUT /api/admin/inventory/{pid}/stock - setup failed", 
                       "Could not get product ID for test", 
                       f"{BASE_URL}/products", status, json.dumps(products))
    
    # 7. GET /api/admin/dashboard - should be 200 (no permission gate)
    status, data = make_request("GET", "/admin/dashboard", manager_token)
    if status == 200 and data.get("kpis") is not None:
        result.add_pass("GET /api/admin/dashboard - 200 for manager (no permission gate)")
    else:
        result.add_fail("GET /api/admin/dashboard - 200 for manager", 
                       f"Expected 200 with kpis, got {status}", 
                       f"{BASE_URL}/admin/dashboard", status, json.dumps(data))
    
    # 8. GET /api/admin/ai-predictions - should be 403 (strict_admin only)
    status, data = make_request("GET", "/admin/ai-predictions", manager_token)
    if status == 403:
        result.add_pass("GET /api/admin/ai-predictions - 403 for manager (strict_admin only)")
    else:
        result.add_fail("GET /api/admin/ai-predictions - 403 for manager", 
                       f"Expected 403, got {status}", 
                       f"{BASE_URL}/admin/ai-predictions", status, json.dumps(data))


def test_address_endpoints(customer_token: str, result: TestResult):
    """Test address endpoints with area_name + lat/lng"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing Address Endpoints{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # 1. POST /api/addresses - add address with area_name + lat/lng
    address_data = {
        "label": "Office",
        "apartment": "Tech Park",
        "flat": "503",
        "floor": "5",
        "landmark": "Near metro",
        "area_name": "Whitefield, Bengaluru",
        "lat": 12.9716,
        "lng": 77.5946,
        "is_default": False
    }
    status, data = make_request("POST", "/addresses", customer_token, address_data)
    if status == 200 and data.get("addresses"):
        # Check if the new address has area_name + lat/lng
        addresses = data.get("addresses", [])
        office_addr = next((a for a in addresses if a.get("label") == "Office"), None)
        if office_addr and office_addr.get("area_name") == "Whitefield, Bengaluru" and office_addr.get("lat") == 12.9716:
            result.add_pass("POST /api/addresses - add address with area_name + lat/lng preserved")
        else:
            result.add_fail("POST /api/addresses - add address with area_name + lat/lng", 
                           "area_name or lat/lng not preserved", 
                           f"{BASE_URL}/addresses", status, json.dumps(data))
    else:
        result.add_fail("POST /api/addresses - add address", 
                       f"Expected 200 with addresses, got {status}", 
                       f"{BASE_URL}/addresses", status, json.dumps(data))
    
    # 2. GET /api/auth/me - confirm address is in user.addresses
    status, data = make_request("GET", "/auth/me", customer_token)
    if status == 200 and data.get("addresses"):
        addresses = data.get("addresses", [])
        office_addr = next((a for a in addresses if a.get("label") == "Office"), None)
        if office_addr:
            result.add_pass("GET /api/auth/me - confirm address in user.addresses")
        else:
            result.add_fail("GET /api/auth/me - confirm address in user.addresses", 
                           "Office address not found", 
                           f"{BASE_URL}/auth/me", status, json.dumps(data))
    else:
        result.add_fail("GET /api/auth/me - confirm address", 
                       f"Expected 200 with addresses, got {status}", 
                       f"{BASE_URL}/auth/me", status, json.dumps(data))


def test_smoke_tests(admin_token: str, result: TestResult):
    """Quick smoke tests on existing flows"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing Smoke Tests (Regression){RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # 1. GET /api/products - returns array
    status, data = make_request("GET", "/products", admin_token)
    if status == 200 and isinstance(data, list):
        result.add_pass("GET /api/products - returns array")
    else:
        result.add_fail("GET /api/products - returns array", 
                       f"Expected 200 with list, got {status}", 
                       f"{BASE_URL}/products", status, json.dumps(data))
    
    # 2. GET /api/admin/inventory - has items + low_stock arrays
    status, data = make_request("GET", "/admin/inventory", admin_token)
    if status == 200 and data.get("items") is not None and data.get("low_stock") is not None:
        result.add_pass("GET /api/admin/inventory - has items + low_stock arrays")
    else:
        result.add_fail("GET /api/admin/inventory - has items + low_stock", 
                       f"Expected 200 with items and low_stock, got {status}", 
                       f"{BASE_URL}/admin/inventory", status, json.dumps(data))


def main():
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}DairyNest Backend API Testing Suite{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    result = TestResult()
    
    # Login all users
    print(f"{YELLOW}Logging in test users...{RESET}\n")
    admin_token = login(CREDENTIALS["admin"])
    manager_token = login(CREDENTIALS["manager"])
    customer_token = login(CREDENTIALS["customer"])
    
    if not admin_token:
        print(f"{RED}Failed to login as admin. Aborting tests.{RESET}")
        sys.exit(1)
    
    if not manager_token:
        print(f"{RED}Failed to login as manager. Some tests will be skipped.{RESET}")
    
    if not customer_token:
        print(f"{RED}Failed to login as customer. Some tests will be skipped.{RESET}")
    
    print(f"{GREEN}Login successful!{RESET}\n")
    
    # Run tests in priority order
    test_coupon_endpoints(admin_token, result)
    test_agent_endpoints(admin_token, result)
    test_manager_endpoints(admin_token, result)
    
    if manager_token:
        test_permission_gating(manager_token, result)
    else:
        print(f"{YELLOW}Skipping permission gating tests (manager login failed){RESET}")
    
    if customer_token:
        test_address_endpoints(customer_token, result)
    else:
        print(f"{YELLOW}Skipping address tests (customer login failed){RESET}")
    
    test_smoke_tests(admin_token, result)
    
    # Print summary
    success = result.summary()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
