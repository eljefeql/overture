#!/bin/bash
URL="https://haptjelzekjdjerrditm.supabase.co"
KEY="sb_publishable_t2Vxy5koyMt5w4ubFtllMg_l34vO9Si"
T=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"qa.maker.1@overturestage.com","password":"OvertureQA2026!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "$URL/rest/v1/profiles?id=eq.1822ce3f-f66e-4363-8d4a-bbee2054f0e0" -H "apikey: $KEY" -H "Authorization: Bearer $T"
