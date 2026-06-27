"""One-off + reusable cleanup of QA/placeholder users from the database.

Deletes users whose email is a known test/placeholder pattern
(id_start_*, id_noapp_*, *_test_*@test.com, etc.). Safe to run repeatedly.
"""
import os
import re
from pathlib import Path
from pymongo import MongoClient

# Load backend/.env without external deps
ENV = Path(__file__).resolve().parent.parent / ".env"
for line in ENV.read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

query = {
    "$or": [
        {"email": {"$regex": r"^id_start_", "$options": "i"}},
        {"email": {"$regex": r"^id_noapp_", "$options": "i"}},
        {"email": {"$regex": r"^id_session_", "$options": "i"}},
        {"email": {"$regex": r"^id_kyc_", "$options": "i"}},
        {"email": {"$regex": r"^sched_test_", "$options": "i"}},
        {"email": {"$regex": r"^resto_test_", "$options": "i"}},
        {"email": {"$regex": r"^driver_test_", "$options": "i"}},
        {"email": {"$regex": r"^qa_test_", "$options": "i"}},
        {"email": {"$regex": r"@(test\.com|example\.(com|org|net)|test\.test)$", "$options": "i"}},
    ]
}

matches = list(db.users.find(query, {"_id": 0, "email": 1}))
print(f"Matched {len(matches)} placeholder/test users")
for m in matches[:50]:
    print("  -", m.get("email"))

res = db.users.delete_many(query)
print(f"Deleted {res.deleted_count} users")
client.close()
