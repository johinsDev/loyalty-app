import json, urllib.request

ORG = "d80b9af6-75b8-4e34-a80d-4da891fec854"
P = {  # products
 "brown":"2bde711a-2470-45ae-b240-facbd32e2b27", "classic":"3449a5e2-d27c-4cc6-b56b-a1935c42ee1d",
 "taro":"98e7fe73-e30e-45aa-ab2d-47e4df66a8fa", "matchastraw":"60ec4c22-bf47-4718-bbbb-9ad4fdebf397",
 "peach":"00038330-3984-46f2-a96c-bb9405b1510b", "mango":"838670cb-aa9d-43b1-b7df-24b4add60b8d",
}
C = {  # categories
 "frutales":"38686484-361c-4a6b-b222-633c4b6acd16", "general":"8f5a9083-4537-4a4c-8570-1c8f9916ce3d",
 "matcha":"92801ab6-3c10-42a8-86c7-cf8c4f2cef2a", "milktea":"9dbbe59a-ffff-4b3a-bcb0-b59499808118",
}
ADDON_PERLAS = "86a0ea0f-b25d-4152-be8d-2a4c5395ac53"

R = [
 ("T1 Producto gratis (uno)",        "freeProduct",  {"type":"freeProduct","refs":[{"kind":"product","id":P["classic"]}]}, 50),
 ("T2 Producto gratis (categoría)",   "freeProduct",  {"type":"freeProduct","refs":[{"kind":"category","id":C["frutales"]}]}, 60),
 ("T3 Monto off (toda la orden)",        "amountOff",    {"type":"amountOff","refs":[],"amountCents":500000}, 40),
 ("T4 Monto off (categoría)",     "amountOff",    {"type":"amountOff","refs":[{"kind":"category","id":C["milktea"]}],"amountCents":300000}, 30),
 ("T5 Porcentaje off (con tope)",      "percentOff",   {"type":"percentOff","refs":[],"percent":20,"maxDiscountCents":400000}, 35),
 ("T6 Porcentaje off (categoría)",    "percentOff",   {"type":"percentOff","refs":[{"kind":"category","id":C["matcha"]}],"percent":50}, 45),
 ("T7 Adición gratis (Perlas)",       "freeAddon",    {"type":"freeAddon","addonId":ADDON_PERLAS}, 15),
 ("T8 Adición gratis (cualquiera)",          "freeAddon",    {"type":"freeAddon","addonId":None}, 20),
 ("T9 Subir tamaño (categoría General)",     "variantUpgrade",{"type":"variantUpgrade","refs":[{"kind":"category","id":C["general"]}],"optionName":"Tamaño","fromValueLabel":"Mediano","toValueLabel":"Grande"}, 25),
 ("T10 Experiencia",               "experience",   {"type":"experience"}, 10),
]

stmts = [{"type":"execute","stmt":{"sql":"delete from reward where name like 'T% %'"}}]
for i,(name, typ, benefit, pts) in enumerate(R):
    stmts.append({"type":"execute","stmt":{
      "sql":"insert into reward (id, organization_id, status, name, description, type, benefit, points_cost, cost_mode, sections, sort_order, limit_per_customer, created_at, updated_at, published_at) values (?,?,'published',?,?,?,?,?,'or','[]',?,'unlimited',1785500000,1785500000,1785500000)",
      "args":[{"type":"text","value":f"tst-{i:02d}-0000-4000-8000-{i:012d}"},
              {"type":"text","value":ORG},
              {"type":"text","value":name},
              {"type":"text","value":f"Escenario de prueba {i+1}"},
              {"type":"text","value":typ},
              {"type":"text","value":json.dumps(benefit)},
              {"type":"integer","value":str(pts)},
              {"type":"integer","value":str(i)}]}})
stmts.append({"type":"close"})

req = urllib.request.Request("http://localhost:8080/v2/pipeline",
    data=json.dumps({"requests":stmts}).encode(), headers={"Content-Type":"application/json"})
out = json.load(urllib.request.urlopen(req))
errs = [r for r in out["results"] if r["type"]!="ok"]
print("errors:", len(errs))
for e in errs[:5]: print(" ", e["error"]["message"])
print("inserted:", len(R))
