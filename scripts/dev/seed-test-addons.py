#!/usr/bin/env python3
"""Attach add-ons to products so the free-addon rewards can be exercised.

`addon_group` / `addon_group_item` were both empty, so no product offered an
add-on and T7/T8 could never become eligible — the reward panel just said "add
the product to the cart" forever.
"""
import json, urllib.request

ORG = "d80b9af6-75b8-4e34-a80d-4da891fec854"
PERLAS = "86a0ea0f-b25d-4152-be8d-2a4c5395ac53"
PUDDING = "8e8f4803-0f26-478c-82fc-035bdcce04ff"
# New ones, so a group has more than two choices.
NEW = [("addon-jelly-0000-4000-8000-000000000001", "Jelly de lychee", 150000),
       ("addon-shot-00000-4000-8000-000000000002", "Shot de espresso", 250000),
       ("addon-crema-0000-4000-8000-000000000003", "Crema de queso", 300000)]
# Products that get an add-on group (the three with variants in "General" plus two frutales).
PRODUCTS = ["2bde711a-2470-45ae-b240-facbd32e2b27",  # Brown Sugar Boba
            "3449a5e2-d27c-4cc6-b56b-a1935c42ee1d",  # Classic Milk Tea
            "98e7fe73-e30e-45aa-ab2d-47e4df66a8fa",  # Taro Milk Tea
            "60ec4c22-bf47-4718-bbbb-9ad4fdebf397",  # Matcha Strawberry
            "00038330-3984-46f2-a96c-bb9405b1510b"]  # Peach Oolong

txt = lambda v: {"type": "text", "value": v}
num = lambda v: {"type": "integer", "value": str(v)}

stmts = []
for aid, name, delta in NEW:
    stmts.append({"type": "execute", "stmt": {
        "sql": "insert or ignore into addon (id, organization_id, name, price_delta_cents, cost_cents, stock_mode, currency, active, sort_order, created_at, updated_at) values (?,?,?,?,0,'infinite','COP',1,0,1785500000,1785500000)",
        "args": [txt(aid), txt(ORG), txt(name), num(delta)]}})

all_addons = [PERLAS, PUDDING] + [a[0] for a in NEW]
for pi, pid in enumerate(PRODUCTS):
    gid = f"agrp-{pi:02d}-0000-4000-8000-{pi:012d}"
    stmts.append({"type": "execute", "stmt": {
        "sql": "insert or ignore into addon_group (id, product_id, name, source, selection_type, min_select, max_select, required, sort_order) values (?,?,'Adiciones','manual','multi',0,3,0,0)",
        "args": [txt(gid), txt(pid)]}})
    for ai, aid in enumerate(all_addons):
        stmts.append({"type": "execute", "stmt": {
            "sql": "insert or ignore into addon_group_item (id, group_id, addon_id, sort_order) values (?,?,?,?)",
            "args": [txt(f"agit-{pi:02d}{ai:02d}-4000-8000-{pi:06d}{ai:06d}"), txt(gid), txt(aid), num(ai)]}})
stmts.append({"type": "close"})

req = urllib.request.Request("http://localhost:8080/v2/pipeline",
    data=json.dumps({"requests": stmts}).encode(), headers={"Content-Type": "application/json"})
out = json.load(urllib.request.urlopen(req))
errs = [r for r in out["results"] if r["type"] != "ok"]
print("errors:", len(errs))
for e in errs[:5]:
    print(" ", e["error"]["message"])
print(f"groups: {len(PRODUCTS)}  addons per group: {len(all_addons)}")
