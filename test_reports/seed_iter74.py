import sys
from pathlib import Path
from pymongo import MongoClient

cfg = {}
for line in Path("/app/backend/.env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, _, v = line.partition("=")
        cfg[k.strip()] = v.strip().strip('"').strip("'")
client = MongoClient(cfg["MONGO_URL"])
db = client[cfg["DB_NAME"]]

REC_ID = "TEST_qa74_ui_applicant"
if sys.argv[1] == "seed":
    db.service_pro_applications.delete_many({"id": REC_ID})
    db.service_pro_applications.insert_one({
        "id": REC_ID,
        "name": "TEST_QA74 UI Applicant",
        "email": "qa74_ui_applicant@test.com",
        "phone": "+18680000001",
        "service_type": "handyman",
        "city": "Port of Spain",
        "status": "pending",
        "created_at": "2026-07-01T00:00:00+00:00",
    })
    print("seeded", REC_ID)
else:
    print("deleted service_pro:", db.service_pro_applications.delete_many({"id": REC_ID}).deleted_count)
    print("deleted favourites:", db.reply_favourites.delete_many({"body": {"$regex": "TEST_QA74"}}).deleted_count)
    print("remaining favourites:", db.reply_favourites.count_documents({}))
client.close()
