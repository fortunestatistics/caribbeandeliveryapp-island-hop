"""Document upload/download routes (driver KYC docs + merchant/business onboarding docs).

Files are stored in private Emergent Object Storage; metadata in `driver_documents`
/ `business_documents`. Downloads support `?auth=<jwt>` so <img>/<iframe> tags work.
"""
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Query
from fastapi.responses import Response

import storage_client
from core import db, get_current_user_from_request, client_ip, rate_limit_ok

router = APIRouter(prefix="/api")

ALLOWED_DOC_TYPES = {
    "driversLicense", "vehicleRegistration", "insurance",
    "profilePhoto",
}
MAX_DOC_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/drivers/documents")
async def upload_driver_document(
    request: Request,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
):
    """Securely upload one driver identity document to private object storage.

    Returns a document_id that the applicant attaches to their driver application.
    """
    current_user = await get_current_user_from_request(request)
    if doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid doc_type. Allowed: {sorted(ALLOWED_DOC_TYPES)}")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_DOC_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    ext = (file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin")
    content_type = file.content_type or storage_client.MIME_TYPES.get(ext, "application/octet-stream")
    if ext not in storage_client.MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, JPG, PNG, or WEBP.")

    document_id = str(uuid.uuid4())
    storage_path = f"{storage_client.APP_NAME}/driver-docs/{current_user.id}/{document_id}.{ext}"
    try:
        result = await asyncio.to_thread(storage_client.put_object, storage_path, data, content_type)
    except Exception as e:  # noqa: BLE001
        logging.error(f"Driver document upload failed for {current_user.id}/{doc_type}: {e}")
        raise HTTPException(status_code=502, detail="Document storage failed. Please try again.")

    await db.driver_documents.insert_one({
        "id": document_id,
        "user_id": current_user.id,
        "doc_type": doc_type,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"document_id": document_id, "doc_type": doc_type, "filename": file.filename}


@router.get("/drivers/documents/{document_id}/download")
async def download_driver_document(document_id: str, request: Request, auth: Optional[str] = Query(None)):
    """Stream a driver document. Accessible only to the owner or an admin.

    Supports `?auth=<jwt>` so <img>/<iframe> tags (which can't send headers) work.
    """
    # Auth: header Bearer OR ?auth= query param (for img/iframe tags)
    if auth and not request.headers.get("Authorization"):
        request.scope.setdefault("headers", [])
        request.scope["headers"].append((b"authorization", f"Bearer {auth}".encode()))
    current_user = await get_current_user_from_request(request)

    record = await db.driver_documents.find_one({"id": document_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    if current_user.user_type != "admin" and record["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this document")

    try:
        data, content_type = await asyncio.to_thread(storage_client.get_object, record["storage_path"])
    except Exception as e:  # noqa: BLE001
        logging.error(f"Driver document fetch failed for {document_id}: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve document")
    return Response(content=data, media_type=record.get("content_type", content_type))


@router.post("/business/documents")
async def upload_business_document(
    request: Request,
    doc_type: str = Form("other"),
    file: UploadFile = File(...),
):
    """Upload one merchant/business onboarding document to object storage.
    Auth is best-effort (the applicant is usually a signed-in customer). Returns a
    document_id that the applicant attaches to their business application."""
    uid = None
    try:
        cu = await get_current_user_from_request(request)
        uid = cu.id
    except Exception:  # noqa: BLE001
        uid = None

    # Rate limit uploads (endpoint allows anonymous applicants) to prevent storage abuse.
    rl_key = f"bizdoc:{uid or client_ip(request)}"
    if not rate_limit_ok(rl_key, max_calls=20, window_seconds=300):
        raise HTTPException(status_code=429, detail="Too many uploads. Please wait a few minutes and try again.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_DOC_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    ext = (file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin")
    if ext not in storage_client.MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, JPG, PNG, or WEBP.")
    content_type = file.content_type or storage_client.MIME_TYPES.get(ext, "application/octet-stream")

    document_id = str(uuid.uuid4())
    storage_path = f"{storage_client.APP_NAME}/business-docs/{uid or 'anon'}/{document_id}.{ext}"
    try:
        result = await asyncio.to_thread(storage_client.put_object, storage_path, data, content_type)
    except Exception as e:  # noqa: BLE001
        logging.error(f"Business document upload failed for {uid}/{doc_type}: {e}")
        raise HTTPException(status_code=502, detail="Document storage failed. Please try again.")

    await db.business_documents.insert_one({
        "id": document_id,
        "user_id": uid,
        "doc_type": doc_type,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "document_id": document_id,
        "doc_type": doc_type,
        "filename": file.filename,
        "is_image": content_type.startswith("image/"),
    }


@router.get("/business/documents/{document_id}/download")
async def download_business_document(document_id: str, request: Request, auth: Optional[str] = Query(None)):
    """Stream a business document. Accessible to an admin/agent or the owner.
    Supports `?auth=<jwt>` so <img>/<iframe> tags (which can't send headers) work."""
    if auth and not request.headers.get("Authorization"):
        request.scope.setdefault("headers", [])
        request.scope["headers"].append((b"authorization", f"Bearer {auth}".encode()))
    current_user = await get_current_user_from_request(request)

    record = await db.business_documents.find_one({"id": document_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    if current_user.user_type not in ("admin", "agent") and record.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this document")

    try:
        data, content_type = await asyncio.to_thread(storage_client.get_object, record["storage_path"])
    except Exception as e:  # noqa: BLE001
        logging.error(f"Business document fetch failed for {document_id}: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve document")
    return Response(content=data, media_type=record.get("content_type", content_type))
