import json
import os

collection_path = "Auto Invest Engine.postman_collection.json"

with open(collection_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

existing_vars = {v["key"] for v in data.get("variable", [])}

new_vars = ["planId", "questionId", "answerId"]

for var in new_vars:
    if var not in existing_vars:
        data["variable"].append({
            "key": var,
            "value": "",
            "type": "string"
        })

with open(collection_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Added variables successfully.")
