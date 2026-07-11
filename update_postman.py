import json
import os

collection_path = "Auto Invest Engine.postman_collection.json"

with open(collection_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

def create_request(name, method, url_raw, body=None):
    req = {
        "name": name,
        "request": {
            "method": method,
            "header": [],
            "url": {
                "raw": url_raw,
                "host": ["{{gatewayUrl}}" if "{{gatewayUrl}}" in url_raw else ("{{portfolioUrl}}" if "{{portfolioUrl}}" in url_raw else "{{authUrl}}")],
                "path": url_raw.split("}}")[1].strip("/").split("/")
            }
        },
        "response": []
    }
    if body:
        req["request"]["header"].append({"key": "Content-Type", "value": "application/json"})
        req["request"]["body"] = {
            "mode": "raw",
            "raw": body
        }
    return req

# We will add Admin Routes to App Gateway
admin_folder = {
    "name": "Admin",
    "item": [
        create_request("Create Product Type", "POST", "{{gatewayUrl}}/admin/product-types", '{\n  "name": "New Product",\n  "description": "Desc"\n}'),
        create_request("Update Product Type", "PUT", "{{gatewayUrl}}/admin/product-types/{{productTypeId}}", '{\n  "name": "Updated Product"\n}'),
        create_request("Deactivate Product Type", "PATCH", "{{gatewayUrl}}/admin/product-types/{{productTypeId}}/deactivate"),
        create_request("Get Risk Profile Templates", "GET", "{{gatewayUrl}}/admin/risk-profile-templates/moderate"),
        create_request("Update Risk Profile Templates", "PUT", "{{gatewayUrl}}/admin/risk-profile-templates/moderate", '[\n  {\n    "productTypeId": "{{productTypeId}}",\n    "weight": 1.0\n  }\n]'),
        create_request("List Questions", "GET", "{{gatewayUrl}}/admin/quiz/questions"),
        create_request("List Active Questions", "GET", "{{gatewayUrl}}/admin/quiz/questions/active"),
        create_request("List Question Answers", "GET", "{{gatewayUrl}}/admin/quiz/questions/{{questionId}}/answers"),
        create_request("Create Question", "POST", "{{gatewayUrl}}/admin/quiz/questions", '{\n  "text": "New Question?",\n  "displayOrder": 1\n}'),
        create_request("Create Question With Answers", "POST", "{{gatewayUrl}}/admin/quiz/questions/with-answers", '{\n  "text": "New Question?",\n  "displayOrder": 1,\n  "answers": []\n}'),
        create_request("Create Answers", "POST", "{{gatewayUrl}}/admin/quiz/questions/{{questionId}}/answers", '[\n  {\n    "text": "Answer 1",\n    "score": 1\n  }\n]'),
        create_request("Update Question", "PUT", "{{gatewayUrl}}/admin/quiz/questions/{{questionId}}", '{\n  "text": "Updated Question?"\n}'),
        create_request("Update Answer", "PUT", "{{gatewayUrl}}/admin/quiz/answers/{{answerId}}", '{\n  "text": "Updated Answer"\n}'),
        create_request("Inactivate Question", "PATCH", "{{gatewayUrl}}/admin/quiz/questions/{{questionId}}/inactivate"),
        create_request("Delete Question", "DELETE", "{{gatewayUrl}}/admin/quiz/questions/{{questionId}}"),
        create_request("Delete Answer", "DELETE", "{{gatewayUrl}}/admin/quiz/answers/{{answerId}}")
    ]
}

# New Plan Routes
plan_routes_gateway = [
    create_request("Update Plan Preferences", "PATCH", "{{gatewayUrl}}/api/plan/{{planId}}", '{\n  "reservePct": 0.2,\n  "autoInvest": false\n}'),
    create_request("Update Plan Allocations", "PUT", "{{gatewayUrl}}/api/plan/{{planId}}/allocations", '[\n  {\n    "productTypeId": "{{productTypeId}}",\n    "weight": 1.0\n  }\n]'),
    create_request("Fund Plan", "POST", "{{gatewayUrl}}/api/plan/{{planId}}/fund", '{\n  "amount": 100\n}'),
    create_request("Withdraw from Plan", "POST", "{{gatewayUrl}}/api/plan/{{planId}}/withdraw", '{\n  "amount": 50\n}'),
    create_request("Delete Plan", "DELETE", "{{gatewayUrl}}/api/plan/{{planId}}")
]

plan_routes_portfolio = [
    create_request("Update Plan Preferences", "PATCH", "{{portfolioUrl}}/plan/{{planId}}", '{\n  "reservePct": 0.2,\n  "autoInvest": false\n}'),
    create_request("Update Plan Allocations", "PUT", "{{portfolioUrl}}/plan/{{planId}}/allocations", '[\n  {\n    "productTypeId": "{{productTypeId}}",\n    "weight": 1.0\n  }\n]'),
    create_request("Fund Plan", "POST", "{{portfolioUrl}}/plan/{{planId}}/fund", '{\n  "amount": 100\n}'),
    create_request("Withdraw from Plan", "POST", "{{portfolioUrl}}/plan/{{planId}}/withdraw", '{\n  "amount": 50\n}'),
    create_request("Delete Plan", "DELETE", "{{portfolioUrl}}/plan/{{planId}}")
]

for item in data["item"]:
    if item["name"] == "App Gateway":
        # Add Admin folder to App Gateway
        item["item"].append(admin_folder)
        # Find Quiz & Auto-Invest and add plan routes
        for sub_item in item["item"]:
            if sub_item["name"] == "Quiz & Auto-Invest":
                sub_item["item"].extend(plan_routes_gateway)
    elif item["name"] == "Portfolio Service":
        # Find Quiz & Auto-Invest and add plan routes
        for sub_item in item["item"]:
            if sub_item["name"] == "Quiz & Auto-Invest":
                sub_item["item"].extend(plan_routes_portfolio)

with open(collection_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Updated collection successfully.")
