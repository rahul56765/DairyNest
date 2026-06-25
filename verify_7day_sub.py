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

# Find the 7-day commitment subscription
seven_day_sub = None
for sub in subs:
    if sub.get('commitment_days') == 7:
        seven_day_sub = sub
        break

if not seven_day_sub:
    print("No 7-day subscription found!")
else:
    print(f"7-day subscription: {seven_day_sub.get('id')[:8]}")
    print(f"Start: {seven_day_sub.get('start_date')}, End: {seven_day_sub.get('end_date')}")
    
    # Check if it appears in calendar for today+10
    future_date = (date.today() + timedelta(days=10)).isoformat()
    r = requests.get(f"{BASE_URL}/admin/subscriptions/calendar?date_from={future_date}&date_to={future_date}", headers=headers)
    calendar = r.json()
    dates = calendar.get("dates", [])
    
    if dates:
        day = dates[0]
        deliveries = day.get("deliveries", [])
        found = False
        for delivery in deliveries:
            if delivery.get('subscription_id') == seven_day_sub.get('id'):
                found = True
                print(f"\n❌ FAIL: 7-day subscription FOUND in calendar for {future_date} (should be excluded)")
                break
        
        if not found:
            print(f"\n✅ PASS: 7-day subscription correctly EXCLUDED from calendar for {future_date}")
            print(f"   (Date is beyond end_date {seven_day_sub.get('end_date')})")
