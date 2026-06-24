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
  USER BUG REPORT:
  - There are no push notifications. Add push notifications carefully.
  - Admin should be able to send notifications. Every notification should vibrate the phone.
  - Customers should automatically get push notifications on every order update.
  - There is no logout option in admin, manager, delivery agent screens. Add them.
  - Customer logout is also not working — fix it.

backend:
  - task: "Push notifications: register / unregister / list / mark-read"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Added endpoints:
            POST /api/push/register  body: {token, platform}  (auth required)
              - validates token starts with "ExponentPushToken"; $addToSet into user.push_tokens
            POST /api/push/unregister body: {token}  (auth required)  -> $pull from user.push_tokens
            GET /api/notifications  -> last 100 notifications for the user
            PUT /api/notifications/{nid}/read  -> mark single read
            PUT /api/notifications/read-all  -> mark all read
          Helper: send_expo_push(tokens, title, body, data) posts to https://exp.host/--/api/v2/push/send with vibrate pattern + high priority + default channel.
          Helper: notify_user(uid, title, body, data) and notify_role(role, ...) — both persist to db.notifications.
      - working: true
        agent: "testing"
        comment: |
          ✅ ALL TESTS PASSED (Steps 1-7):
          - POST /api/push/register with valid ExponentPushToken → status: registered
          - Token correctly added to user.push_tokens (verified via GET /api/auth/me)
          - Invalid token format (not starting with "ExponentPushToken") → status: skipped, reason: invalid_token_format
          - Invalid tokens NOT added to push_tokens array
          - Duplicate token registration is idempotent (uses $addToSet correctly)
          - POST /api/push/unregister → status: unregistered, token removed from push_tokens
          - GET /api/notifications → 200, returns array
          - PUT /api/notifications/read-all → status: ok (works even with empty notifications)

  - task: "Push broadcast endpoint (admin/marketing-manager)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          POST /api/admin/push/broadcast body: {title, body, target: "all"|"customer"|"agent"|"manager"|"admin", user_ids?}
          Gate: admin_or_manager("marketing") — so admin OR a manager who has marketing permission can use it.
          Returns {sent, recipients}.
      - working: true
        agent: "testing"
        comment: |
          ✅ ALL TESTS PASSED (Steps 8-16):
          - Admin broadcast to customers → 200, recipients: 1 (sent to registered customer)
          - Invalid target "bogus" → 400 with detail: "invalid target"
          - Broadcast to "all" → 200, recipients: 8 (all users in DB)
          - Targeted broadcast with user_ids → 200, recipients: 1 (exact match)
          - Broadcast notification correctly persisted to db.notifications with kind=broadcast
          - Customer role → 403 (correctly forbidden)
          - Manager without marketing permission → 403 (correctly forbidden)
          - Admin grants marketing permission to manager → 200
          - Manager with marketing permission → 200 (now allowed to broadcast)
          Permission gating working perfectly via admin_or_manager("marketing") dependency.

  - task: "Order events auto-push to customer/agent"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Hooked the following endpoints to notify_user automatically:
            POST /api/orders/checkout            -> "Order Placed" -> customer
            POST /api/orders/{oid}/confirm-payment -> "Payment Confirmed" -> customer
            PUT  /api/admin/orders/{oid}/status  -> status-specific msg -> customer
            PUT  /api/admin/orders/{oid}/assign  -> "Out for Delivery" -> customer + "New Delivery Assigned" -> agent
            POST /api/agent/delivery/{oid}/status -> "Order Delivered" / "Delivery Attempt Failed" -> customer
          When no push tokens registered, the calls still succeed (send_expo_push skips empty token list) and the notification row is logged to db.notifications so GET /api/notifications returns history.
      - working: true
        agent: "testing"
        comment: |
          ✅ ALL TESTS PASSED (Steps 17-25):
          - POST /api/orders/checkout → "Order Placed 🛒" notification created with kind=order, order_id
          - POST /api/orders/{oid}/confirm-payment → "Payment Confirmed 💳" notification created
          - PUT /api/admin/orders/{oid}/status (packed) → "Order Packed" notification created
          - PUT /api/admin/orders/{oid}/status (out_for_delivery) → "Out for Delivery" notification created
          - PUT /api/admin/orders/{oid}/assign → TWO notifications:
            * Customer: "Out for Delivery" (second one)
            * Agent: "New Delivery Assigned" with kind=assignment, order_id
          - POST /api/agent/delivery/{oid}/status (delivered) → "Order Delivered ✅" notification created
          - PUT /api/admin/orders/{oid}/status (failed) → "Delivery Failed" notification created
          All order lifecycle events correctly trigger notify_user calls. Notifications persisted to db.notifications with proper metadata.

frontend:
  - task: "Customer logout was not redirecting"
    implemented: true
    working: "NA"
    file: "frontend/src/auth.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - user: "user"
        comment: "Reported: customer logout not working."
      - working: "NA"
        agent: "main"
        comment: |
          ROOT CAUSE: signOut() only cleared SecureStore + setUser(null) -- it never navigated away from the protected (customer)/(agent)/(admin)/(manager) screen, so the user stayed on a now-broken screen.
          FIX: signOut() now ALSO calls router.replace("/login") (imported from expo-router) after clearing token.
          BONUS: posts /api/push/unregister with the stored push token before clearing JWT.
          Idempotent via signingOutRef guard.

  - task: "Logout buttons present in admin/manager/agent screens"
    implemented: true
    working: "NA"
    file: "frontend/app/(admin)/more.tsx, frontend/app/(manager)/more.tsx, frontend/app/(agent)/route.tsx, frontend/app/(admin)/dashboard.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - user: "user"
        comment: "Reported: there is no logout option in admin, manager, delivery agent."
      - working: "NA"
        agent: "main"
        comment: |
          - Admin "More" tab now has a bottom "Log Out" button (testID admin-more-logout) + the existing header SignOut on dashboard.
          - Manager "More" tab now has a bottom "Log Out" button (testID manager-more-logout). Manager dashboard re-exports admin dashboard so its header SignOut also works.
          - Agent already had a SignOut icon in the route header (testID agent-logout); now functional thanks to the auth.tsx fix.

  - task: "Push notification client setup + permission + vibration"
    implemented: true
    working: "NA"
    file: "frontend/src/hooks/use-push-notifications.tsx, frontend/app/_layout.tsx, frontend/app.json"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Added expo-notifications + expo-device (via yarn expo install).
          New <PushNotificationsGate /> mounted in root _layout.tsx:
            - Requests permission once after login
            - Gets ExponentPushToken via getExpoPushTokenAsync (Expo project id auto-discovered)
            - POSTs /api/push/register so backend stores the token on user.push_tokens
            - Sets foreground notification handler (banner + sound)
            - addNotificationReceivedListener -> Vibration.vibrate([0,250,250,250]) on every incoming push
            - Android channel "default" created with MAX importance + vibration pattern + green light + sound
          app.json updated:
            - "expo-notifications" plugin (icon, color, defaultChannel)
            - Android permissions: VIBRATE, RECEIVE_BOOT_COMPLETED, WAKE_LOCK added
          Web: expo-notifications logs a harmless warning; no crash. Native handles fully.

  - task: "Admin Notify broadcast UI"
    implemented: true
    working: "NA"
    file: "frontend/src/components/management.tsx, frontend/app/(admin)/more.tsx, frontend/app/(manager)/more.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          New NotifyTab in management.tsx:
            - Title + multiline body inputs
            - Target selector chips: All / Customers / Agents / Managers / Admins
            - "Send Notification" button -> POST /api/admin/push/broadcast
            - Shows success toast with sent/recipients count
          Wired into:
            - Admin "More" -> always visible (testIDs nf-title, nf-body, nf-target-customer, nf-send)
            - Manager "More" -> visible only if perms.marketing === true

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Implemented full push notifications stack + fixed all logouts.

      Backend additions to verify (use OTP 123456 for any phone):
        1) Push registration (auth required):
           - POST /api/push/register  body: {"token":"ExponentPushToken[abc123]","platform":"android"} as a customer -> {"status":"registered"}
           - POST /api/push/register  body: {"token":"NotAValidToken","platform":"android"} -> {"status":"skipped","reason":"invalid_token_format"}  (no DB write)
           - GET  /api/auth/me -> verify user.push_tokens contains the registered token (after a valid register)
           - POST /api/push/unregister body: {"token":"ExponentPushToken[abc123]"} -> {"status":"unregistered"}; /api/auth/me no longer has that token

        2) Notification history:
           - GET /api/notifications -> 200, returns array (may be empty for fresh customer)
           - Trigger an event (see #4) and re-GET /api/notifications -> new item present with title/body/data
           - PUT /api/notifications/{nid}/read -> read=true
           - PUT /api/notifications/read-all -> all read=true

        3) Admin broadcast (auth as admin 6398213389):
           - POST /api/admin/push/broadcast body {"title":"Hi","body":"Test","target":"customer"} -> {sent, recipients} with recipients>=1
           - POST .../broadcast body {"title":"X","body":"Y","target":"bogus"} -> 400 invalid target
           - POST .../broadcast as MANAGER 9000000004 (has marketing perm? -- by default seed Mary has customers/orders/inventory/support but NOT marketing; verify that): expect 403. Then have admin grant marketing perm and verify the same manager call returns 200.
           - POST .../broadcast as CUSTOMER -> expect 403.
           - POST .../broadcast with user_ids: [<customer_id>] -> recipients=1

        4) Order events triggering auto-push (verify GET /api/notifications afterwards):
           - As customer: POST /api/cart  add a product, POST /api/orders/checkout {"address_id":<addr>,"slot":"morning","payment_method":"cod"} -> verify a "Order Placed" notification appears in GET /api/notifications.
           - As customer: POST /api/orders/{oid}/confirm-payment -> "Payment Confirmed" notification.
           - As admin:   PUT /api/admin/orders/{oid}/status body {"status":"packed"} -> customer gets "Order Packed".
           - As admin:   PUT /api/admin/orders/{oid}/status body {"status":"out_for_delivery"} -> customer gets "Out for Delivery".
           - As admin:   PUT /api/admin/orders/{oid}/assign?agent_id=<agentId> -> customer gets a notification AND the assigned agent's notifications now has "New Delivery Assigned".
           - As agent:   POST /api/agent/delivery/{oid}/status body {"status":"delivered"} -> customer gets "Order Delivered ✅".
           - As admin:   PUT /api/admin/orders/{oid}/status body {"status":"failed"} -> customer gets "Delivery Failed".

      All notify calls should succeed even when the target user has no push_tokens registered (Expo Push API just won't be hit). The notification row in /api/notifications is the source of truth for the test.

      No need to retest features from the previous round (managers, agents, coupons CRUD, address area_name) unless they regress.
  
  - agent: "testing"
    message: |
      🎉 BACKEND TESTING COMPLETE - ALL 34 TESTS PASSED! 🎉
      
      Comprehensive backend verification completed for push notifications bug fix.
      
      TEST RESULTS SUMMARY:
      ✅ Push token registration/unregistration (7 tests) - ALL PASSED
      ✅ Notification history endpoints (2 tests) - ALL PASSED  
      ✅ Admin broadcast functionality (5 tests) - ALL PASSED
      ✅ Permission gating on broadcast (4 tests) - ALL PASSED
      ✅ Auto-push on order events (16 tests) - ALL PASSED
      
      VERIFIED FUNCTIONALITY:
      1. Push token registration validates ExponentPushToken format correctly
      2. Invalid tokens are rejected without DB writes
      3. Token registration is idempotent (uses $addToSet)
      4. Token unregistration works correctly (uses $pull)
      5. Notification history endpoints return proper data structures
      6. Admin broadcast works for all target types (all, customer, agent, manager, admin)
      7. Invalid broadcast targets return 400 errors
      8. Permission gating correctly enforces admin_or_manager("marketing") dependency
      9. All order lifecycle events trigger appropriate notifications:
         - Order placed, payment confirmed, packed, out for delivery, delivered, failed
      10. Agent assignment triggers notifications to both customer and agent
      11. All notifications persist to db.notifications with proper metadata (kind, order_id, etc.)
      12. Backend logs show successful Expo Push API calls (HTTP 200)
      
      NO ISSUES FOUND. All backend APIs working as expected.
