#!/usr/bin/env python3
import requests
from datetime import date, timedelta

BASE_URL = "https://5789b2e0-9c3a-44e5-9042-ce17e63be12c.preview.emergentagent.com/api"
OTP = "123456"
ADMIN_PHONE = "6398213389"

# Login as admin
r = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": ADMIN_PHONE})
r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": ADMIN_PHONE, "code": OTP})
admin_token = r.json().get("token")
headers = {"Authorization": f"Bearer {admin_token}"}

# Get all subscriptions
r = requests.get(f"{BASE_URL}/admin/subscriptions", headers=headers)
subs = r.json()

print(f"Total active subscriptions: {len(subs)}")
print("\nSubscription details:")
for i, sub in enumerate(subs, 1):
    print(f"\n{i}. Subscription {sub.get('id')[:8]}")
    print(f"   User: {sub.get('customer', {}).get('name')} ({sub.get('customer', {}).get('phone')})")
    print(f"   Milk: {sub.get('milk_type')}, {sub.get('quantity_label')}")
    print(f"   Frequency: {sub.get('frequency')}, Schedule: {sub.get('schedule')}")
    print(f"   Commitment: {sub.get('commitment_days')} days")
    print(f"   Start: {sub.get('start_date')}, End: {sub.get('end_date')}")
    print(f"   Status: {sub.get('status')}")

# Check calendar for today+10
future_date = (date.today() + timedelta(days=10)).isoformat()
print(f"\n\nChecking calendar for {future_date}:")
r = requests.get(f"{BASE_URL}/admin/subscriptions/calendar?date_from={future_date}&date_to={future_date}", headers=headers)
calendar = r.json()
dates = calendar.get("dates", [])
if dates:
    day = dates[0]
    print(f"Date: {day.get('date')}, Count: {day.get('count')}")
    for delivery in day.get("deliveries", []):
        print(f"  - {delivery.get('name')} ({delivery.get('phone')}): {delivery.get('milk_type')} {delivery.get('quantity_label')}")
        print(f"    Subscription ID: {delivery.get('subscription_id')[:8]}")
