"""Seed one published promo per engine shape, so the register can be exercised
against every type/target/ref combination at once.

Names are prefixed "PXX " and the script deletes that prefix first, so it is
idempotent and never touches the operator's own promos.

Every promo is published, org-wide, audience "all", with NO schedule and NO
conditions — the point is that they all qualify today, so a cart decides which
ones apply and the register's best-of pick is what gets exercised.
"""

import json, urllib.request, time

ORG = "d80b9af6-75b8-4e34-a80d-4da891fec854"
USER = "pXTQmx9FnQCDQypfYGYO9FB0NWipa077"

P = {  # products
    "brown": "2bde711a-2470-45ae-b240-facbd32e2b27",       # General, 16.500/18.500
    "classic": "3449a5e2-d27c-4cc6-b56b-a1935c42ee1d",     # General, 13.500/15.500
    "taro": "98e7fe73-e30e-45aa-ab2d-47e4df66a8fa",        # General, 15.500/17.500
    "matchastraw": "60ec4c22-bf47-4718-bbbb-9ad4fdebf397", # Matcha+Frutales, 17.000/19.000
    "icedmatcha": "7e525f45-9e31-4413-a397-c9e1b5ddd98e",  # Matcha, 15.000/17.000
    "peach": "00038330-3984-46f2-a96c-bb9405b1510b",       # Frutales, 14.500 (no variants)
    "mango": "838670cb-aa9d-43b1-b7df-24b4add60b8d",       # Frutales, 15.500 (no variants)
    "strawcloud": "ff9a4351-ecb9-4331-b829-d46f80b12510",  # Frutales, 16.000 (no variants)
    "dragon": "c3396a51-31d2-49d2-a317-a89e05cd1a5f",      # Especiales, 16.500 (no variants)
    "studio": "b23a7e06-c1aa-42da-9442-ff64667a0f58",      # Especiales, 19.000/21.000
    "spring": "c555fbe0-628f-4b1f-a4bc-386c10a63cd4",      # Especiales, 18.000/20.000
}
C = {  # categories
    "milktea": "9dbbe59a-ffff-4b3a-bcb0-b59499808118",   # parent
    "general": "8f5a9083-4537-4a4c-8570-1c8f9916ce3d",   # leaf under Milk Tea
    "clasicos": "8a9c3adf-17f0-457a-a417-963699cf364b",  # leaf under Milk Tea
    "premium": "94bf97ba-76b5-47ef-9ec7-c73d66bd2fba",   # leaf under Milk Tea
    "frutales": "38686484-361c-4a6b-b222-633c4b6acd16",
    "matcha": "92801ab6-3c10-42a8-86c7-cf8c4f2cef2a",
    "especiales": "5efaedcc-8e43-4b46-8f7f-1b2363d0e2ac",
}
V = {  # variants
    "brown_g": "54deae42-c4b5-4604-b946-5480672cef0f",   # 18.500
    "classic_g": "9c49a0e9-4c7d-485e-bb3e-8759ce1f1d6d", # 15.500
    "studio_g": "f41879c5-ac79-4b0a-b84a-e9a65d1fd7cd",  # 21.000
    # Synthetic id shape (`var::<id>::<slug>`) — worth covering, it is not a uuid.
    "matchastraw_g": "var::9d62681b-27ad-4998-a2ea-f6fcb78cf5e4::grande",
}

prod = lambda k: {"kind": "product", "id": P[k]}
cat = lambda k: {"kind": "category", "id": C[k]}
var = lambda k: {"kind": "variant", "id": V[k]}

# (name, type, short_description, badge, rule, exclusive)
PROMOS = [
    # ── percentOff: order / category / product+cap / variant ──────────────────
    ("P01 % off toda la orden", "percentOff", "10% sobre el total, sin condiciones.", "-10%",
     {"buy": {"requirements": []},
      "effect": {"kind": "percentOff", "percent": 10, "target": "order"}}, False),

    ("P02 % off categoría Matcha", "percentOff", "20% en los productos de Matcha.", "-20%",
     {"buy": {"requirements": [{"refs": [cat("matcha")], "qty": 1}]},
      "effect": {"kind": "percentOff", "percent": 20, "target": "buy"}}, False),

    ("P03 % off con tope (Studio)", "percentOff", "30% en Studio Showcase, máximo $3.000.", "-30%",
     {"buy": {"requirements": [{"refs": [prod("studio")], "qty": 1}]},
      "effect": {"kind": "percentOff", "percent": 30, "target": "buy",
                 "maxDiscountCents": 300000}}, False),

    ("P04 % off una variante (Brown Grande)", "percentOff",
     "25% solo en el tamaño Grande de Brown Sugar Boba.", "-25%",
     {"buy": {"requirements": [{"refs": [var("brown_g")], "qty": 1}]},
      "effect": {"kind": "percentOff", "percent": 25, "target": "buy"}}, False),

    # ── amountOff: order / product ───────────────────────────────────────────
    ("P05 $ off toda la orden", "amountOff", "$3.000 de descuento sobre el total.", "-$3K",
     {"buy": {"requirements": []},
      "effect": {"kind": "amountOff", "amountCents": 300000, "target": "order"}}, False),

    ("P06 $ off un producto (Taro)", "amountOff", "$2.000 menos en Taro Milk Tea.", "-$2K",
     {"buy": {"requirements": [{"refs": [prod("taro")], "qty": 1}]},
      "effect": {"kind": "amountOff", "amountCents": 200000, "target": "buy"}}, False),

    # ── nxm / secondUnit / combo ─────────────────────────────────────────────
    ("P07 3x2 en Frutales", "nxm", "Lleva 3 frutales y el más barato va gratis.", "3x2",
     {"buy": {"requirements": [{"refs": [cat("frutales")], "qty": 3}]},
      "effect": {"kind": "freeUnits", "count": 1, "target": "buy"}}, False),

    ("P08 2.ª unidad al 50% (General)", "secondUnit",
     "Dos de la categoría General: la más barata a mitad de precio.", "2.ª -50%",
     {"buy": {"requirements": [{"refs": [cat("general")], "qty": 2}]},
      "effect": {"kind": "percentOff", "percent": 50, "target": "buy",
                 "select": {"count": 1, "pick": "cheapest"}},
      # Once per ticket, matching the template. Without it five drinks made two
      # pairs and took half off two of them.
      "maxApplicationsPerOrder": 1}, False),

    ("P09 Combo Milk Tea a $28.000", "combo",
     "Dos Milk Tea por $28.000 cerrados.", "Combo",
     {"buy": {"requirements": [{"refs": [cat("milktea")], "qty": 2}]},
      "effect": {"kind": "fixedPrice", "priceCents": 2800000},
      "maxApplicationsPerOrder": 1}, False),

    # ── cartThreshold ────────────────────────────────────────────────────────
    ("P10 $4.000 off desde $40.000", "cartThreshold",
     "Descuento por monto mínimo de compra.", "-$4K",
     {"buy": {"requirements": [], "minSubtotalCents": 4000000},
      "effect": {"kind": "amountOff", "amountCents": 400000, "target": "order"},
      "maxApplicationsPerOrder": 1}, False),

    # ── volumeTiered ─────────────────────────────────────────────────────────
    ("P11 Compra más, ahorra más", "volumeTiered",
     "5% llevando 1, 15% llevando 3, 25% llevando 5 o más.", "-25%",
     {"buy": {"requirements": [{"refs": [], "qty": 1}]},
      "effect": {"kind": "tieredPercent", "tiers": [
          {"minQty": 1, "percent": 5},
          {"minQty": 3, "percent": 15},
          {"minQty": 5, "percent": 25}]}}, False),

    # ── crossSell: free get-side / discounted get-side ───────────────────────
    ("P12 Milk Tea + Peach Oolong gratis", "crossSell",
     "Comprá un Milk Tea y el Peach Oolong va gratis.", "Gratis",
     {"buy": {"requirements": [{"refs": [cat("milktea")], "qty": 1}]},
      "get": {"requirements": [{"refs": [prod("peach")], "qty": 1}]},
      "effect": {"kind": "percentOff", "percent": 100, "target": "get"},
      "maxApplicationsPerOrder": 1}, False),

    ("P13 Classic + Matcha al 50%", "crossSell",
     "Con un Classic Milk Tea, el matcha sale a mitad de precio.", "-50%",
     {"buy": {"requirements": [{"refs": [prod("classic")], "qty": 1}]},
      "get": {"requirements": [{"refs": [cat("matcha")], "qty": 1}]},
      "effect": {"kind": "percentOff", "percent": 50, "target": "get"},
      "maxApplicationsPerOrder": 1}, False),

    # ── pointsMultiplier (no money discount at all) ──────────────────────────
    ("P14 Puntos x3", "pointsMultiplier", "El triple de puntos en toda la compra.", "x3",
     {"buy": {"requirements": []},
      "effect": {"kind": "pointsMultiplier", "multiplier": 3}}, False),

    # ── bundle: two DIFFERENT requirements in one trigger ────────────────────
    ("P15 Bundle Classic + Dragon", "bundle",
     "Llevando un Classic Milk Tea y un Dragon Fruit Fizz, $5.000 menos.", "Bundle",
     {"buy": {"requirements": [
         {"refs": [prod("classic")], "qty": 1},
         {"refs": [prod("dragon")], "qty": 1}]},
      "effect": {"kind": "amountOff", "amountCents": 500000, "target": "buy"},
      "maxApplicationsPerOrder": 1}, False),

    # ── exclusive: does not stack with a reward or the tier benefit ──────────
    ("P16 Exclusiva -40% Especiales", "percentOff",
     "40% en Especiales. No se combina con premios ni beneficio de nivel.", "-40%",
     {"buy": {"requirements": [{"refs": [cat("especiales")], "qty": 1}]},
      "effect": {"kind": "percentOff", "percent": 40, "target": "buy"}}, True),
]


def call(stmts):
    body = json.dumps({"requests": stmts + [{"type": "close"}]}).encode()
    req = urllib.request.Request("http://localhost:8080/v2/pipeline", data=body,
                                 headers={"content-type": "application/json"})
    out = json.load(urllib.request.urlopen(req))
    for r in out["results"]:
        if r.get("type") == "error":
            raise SystemExit("SQL error: " + r["error"]["message"])
    return out


now = int(time.time())
stmts = [{"type": "execute", "stmt": {"sql": "delete from promo where name like 'P__ %'"}}]
for i, (name, typ, desc, badge, rule, exclusive) in enumerate(PROMOS):
    stmts.append({"type": "execute", "stmt": {
        "sql": (
            "insert into promo (id, organization_id, created_by_user_id, status, name, slug,"
            " type, rule, conditions, short_description, badge_label, created_at, updated_at,"
            " published_at, sort_order, exclusive, featured, audience_type)"
            " values (?,?,?,'published',?,?,?,?,'{}',?,?,?,?,?,?,?,0,'all')"),
        "args": [
            {"type": "text", "value": f"00000000-0000-4000-8000-{i:012d}"},
            {"type": "text", "value": ORG},
            {"type": "text", "value": USER},
            {"type": "text", "value": name},
            {"type": "text", "value": f"test-promo-{i:02d}"},
            {"type": "text", "value": typ},
            {"type": "text", "value": json.dumps(rule)},
            {"type": "text", "value": desc},
            {"type": "text", "value": badge},
            {"type": "integer", "value": str(now)},
            {"type": "integer", "value": str(now)},
            {"type": "integer", "value": str(now)},
            {"type": "integer", "value": str(100 + i)},
            {"type": "integer", "value": "1" if exclusive else "0"},
        ],
    }})

call(stmts)
print(f"seeded {len(PROMOS)} test promos (P01..P{len(PROMOS):02d})")
