#!/bin/bash
URL="https://haptjelzekjdjerrditm.supabase.co"
KEY="sb_publishable_t2Vxy5koyMt5w4ubFtllMg_l34vO9Si"
T=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"qa.actor.02@overturestage.com","password":"OvertureQA2026!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -w " [HTTP %{http_code}]\n" -X PATCH "$URL/rest/v1/audition_signups?id=eq.2fa5d4b5-2d3a-458e-b272-e515a8316808" \
  -H "apikey: $KEY" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"conflicts":"2026-08-14 to 2026-08-16"}' | python3 -c "import sys;d=sys.stdin.read();print(d[:200])"
