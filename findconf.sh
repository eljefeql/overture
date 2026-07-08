#!/bin/bash
URL="https://haptjelzekjdjerrditm.supabase.co"
KEY="sb_publishable_t2Vxy5koyMt5w4ubFtllMg_l34vO9Si"
SHOW="965ad8a2-94a1-4f3d-9fc4-6331bf0d500d"
T=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"qa.maker.1@overturestage.com","password":"OvertureQA2026!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "$URL/rest/v1/audition_signups?show_id=eq.$SHOW&actor_id=eq.d03b6500-86cb-4d47-aac5-cc649f8cac93&select=conflicts,group_id" -H "apikey: $KEY" -H "Authorization: Bearer $T"
