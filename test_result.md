#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Update super admin and build manager screens carefully. Super admin should have full permissions,
  ability to create manager profiles with module-level permissions, manage inventory and everything.
  Customer can have multiple addresses, and on opening the app, the nearest saved location must be
  fetched; if the user is more than 500m away from any saved address, they should be prompted to
  add a new delivery address.

backend:
  - task: "Address model: add area_name field"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Added area_name field to Address pydantic model; backward-compatible (defaults to empty string)."
      - working: true
        agent: "testing"
        comment: "✓ PASS - POST /api/addresses successfully accepts and preserves area_name, lat, lng fields. Verified address appears in GET /api/auth/me response with all fields intact."

  - task: "Coupon toggle / delete endpoints"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Added PUT /api/admin/coupons/{code}/toggle and DELETE /api/admin/coupons/{code}. Both use admin_or_manager() gate."
      - working: true
        agent: "testing"
        comment: "✓ PASS - All coupon endpoints working: GET list (200), POST create with code uppercasing (200), PUT toggle deactivate/reactivate (200), DELETE (200), verified deletion, 404 for non-existent coupon."

  - task: "Agent create / toggle (admin)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Added POST /api/admin/agents and PUT /api/admin/agents/{aid}/toggle (strict_admin only). Generates default employee_id when omitted."
      - working: true
        agent: "testing"
        comment: "✓ PASS - POST /api/admin/agents creates agent with auto-generated employee_id (200), GET lists agents (200), PUT toggle suspend/unsuspend (200), duplicate phone validation (400). strict_admin gate working correctly."

  - task: "Manager endpoints (create/permissions/toggle)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✓ PASS - GET /api/admin/managers lists managers including Manager Mary (200), POST creates manager with permissions (200), PUT updates permissions (200), PUT toggle suspend (200). All strict_admin gated."

  - task: "Permission gating for manager role"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✓ PASS - Manager (9000000004) correctly blocked from admin-only endpoints: GET/POST /api/admin/managers (403), POST /api/admin/agents (403), GET /api/admin/ai-predictions (403). Manager CAN access permitted endpoints: GET /api/admin/customers (200), GET /api/admin/inventory (200), PUT /api/admin/inventory/{pid}/stock (200), GET /api/admin/dashboard (200)."

  - task: "Backend env restoration (was missing)"
    implemented: true
    working: true
    file: "backend/.env"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "/app/backend/.env was missing — recreated with MONGO_URL, DB_NAME, JWT_SECRET, empty Twilio/Razorpay (dev fallback OTP 123456), EMERGENT_LLM_KEY. Backend now boots and seeds successfully."

  - task: "Smoke tests (products, inventory)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✓ PASS - GET /api/products returns array (200), GET /api/admin/inventory returns items + low_stock arrays (200). No regressions detected."

frontend:
  - task: "Auth type: add 'manager' role + permissions field"
    implemented: true
    working: "NA"
    file: "frontend/src/auth.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Extended User type with manager role, permissions map, suspended flag."

  - task: "Location utilities + hook"
    implemented: true
    working: "NA"
    file: "frontend/src/utils/geo.ts, frontend/src/hooks/use-device-location.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Created haversine, nearestAddress, formatDistance utilities; useDeviceLocation hook with reverseGeocode."

  - task: "LocationBanner on customer home"
    implemented: true
    working: "NA"
    file: "frontend/src/components/location-banner.tsx, frontend/app/(customer)/home.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "On customer home, after fetching device GPS: if nearest saved address is >500m away -> shows banner suggesting to add a new address. If nearest is <=500m but not the default -> offers to switch default. Dismissible per session."

  - task: "Address form GPS capture"
    implemented: true
    working: "NA"
    file: "frontend/app/addresses.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added 'Use current location' button that fetches GPS + reverse-geocode and pins coordinates onto the address being created. Supports ?auto=1 query to auto-open form and pin when launched from LocationBanner."

  - task: "Admin More rebuilt with full management"
    implemented: true
    working: "NA"
    file: "frontend/app/(admin)/more.tsx, frontend/src/components/management.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Now has 8 tabs: Products (Add/Edit/Disable), Inventory (stock editor), Coupons (Create/Toggle/Delete), Managers (Create with permission checkboxes / Edit perms / Suspend), Agents (Create / Suspend), Referrals, AI, Tickets."

  - task: "Manager More: permission-gated"
    implemented: true
    working: "NA"
    file: "frontend/app/(manager)/more.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New file (no longer re-export of admin). Dynamically builds tab list from user.permissions: products->Products, inventory->Inventory, marketing->Coupons+Referrals, support->Tickets. No Managers/Agents/AI tabs (admin-only)."

  - task: "Admin Orders: agent picker bottom-sheet"
    implemented: true
    working: "NA"
    file: "frontend/app/(admin)/orders.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Replaced auto-assign-first-agent with a modal picker listing active agents and their delivered counts."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Implemented major management/permissions update + customer location intelligence.
      Backend: restored missing /app/backend/.env; added coupon toggle/delete, agent create/toggle.
      Frontend: rebuilt admin More with 8-tab management, created permission-gated manager More,
      address GPS capture, and LocationBanner with 500m threshold for adding new addresses.
      Please verify backend changes via deep_testing_backend_v2:
        1) POST /api/admin/agents and PUT /api/admin/agents/{id}/toggle (login as admin 6398213389)
        2) PUT /api/admin/coupons/{code}/toggle and DELETE /api/admin/coupons/{code}
        3) Existing manager endpoints still work (/api/admin/managers POST/PUT)
        4) Manager (9000000004) cannot hit /api/admin/managers (admin-only)
        5) Manager (9000000004) CAN hit /api/admin/inventory (permission grants it)
      Use demo creds in /app/memory/test_credentials.md (OTP 123456 dev fallback).
  - agent: "testing"
    message: |
      ✅ BACKEND TESTING COMPLETE - ALL 28 TESTS PASSED
      
      Comprehensive backend API testing completed successfully. All priority endpoints verified:
      
      1. Coupon Admin Endpoints (7/7 passed):
         - GET /api/admin/coupons - list coupons ✓
         - POST /api/admin/coupons - create with code uppercasing ✓
         - PUT /api/admin/coupons/{code}/toggle - deactivate/reactivate ✓
         - DELETE /api/admin/coupons/{code} - delete coupon ✓
         - Verified deletion and 404 for non-existent ✓
      
      2. Agent Admin Endpoints (5/5 passed):
         - POST /api/admin/agents - create with auto employee_id ✓
         - GET /api/admin/agents - list agents ✓
         - PUT /api/admin/agents/{aid}/toggle - suspend/unsuspend ✓
         - Duplicate phone validation (400) ✓
         - strict_admin gate working correctly ✓
      
      3. Manager Admin Endpoints (4/4 passed):
         - GET /api/admin/managers - list (Manager Mary found) ✓
         - POST /api/admin/managers - create with permissions ✓
         - PUT /api/admin/managers/{mid}/permissions - update ✓
         - PUT /api/admin/managers/{mid}/toggle - suspend ✓
      
      4. Permission Gating (8/8 passed):
         - Manager blocked from admin-only endpoints (403) ✓
         - Manager can access permitted endpoints (200) ✓
         - GET /api/admin/customers, /api/admin/inventory ✓
         - PUT /api/admin/inventory/{pid}/stock ✓
         - GET /api/admin/dashboard (no gate) ✓
         - GET /api/admin/ai-predictions blocked (strict_admin) ✓
      
      5. Address Endpoints (2/2 passed):
         - POST /api/addresses with area_name + lat/lng ✓
         - GET /api/auth/me confirms address in user ✓
      
      6. Smoke Tests (2/2 passed):
         - GET /api/products returns array ✓
         - GET /api/admin/inventory has items + low_stock ✓
      
      All backend features working correctly. No critical issues found.
