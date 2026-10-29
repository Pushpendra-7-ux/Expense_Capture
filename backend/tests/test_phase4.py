"""
backend/tests/test_phase4.py — Unit tests for Phase 4: Gemini extraction pipeline,
caching logic, code-side verification, and rate limiter.
"""

import uuid
from datetime import date
import pytest
from app.extraction_service import (
    compute_cache_key,
    extract_amount_from_text,
    normalize_note,
    ExtractionService,
)
from app.gemini_schemas import (
    CrossCheckStatus,
    CrossChecks,
    FieldConfidence,
    LineItem,
    PerFileClassification,
    GeminiReceiptExtraction,
)
from app.rate_limiter import get_client_ip


def test_normalize_note():
    assert normalize_note("   Late   client debrief \n cab  ") == "late client debrief cab"
    assert normalize_note(None) == ""
    assert normalize_note("") == ""


def test_compute_cache_key_deterministic():
    hashes1 = ["hash_b", "hash_a", "hash_c"]
    hashes2 = ["hash_a", "hash_c", "hash_b"]
    note1 = "Dinner with client"
    note2 = "   dinner   with client  "
    today = "2026-10-28"

    key1 = compute_cache_key(hashes1, note1, today)
    key2 = compute_cache_key(hashes2, note2, today)

    assert key1 == key2
    assert len(key1) == 64  # sha256 hex length


def test_extract_amount_from_text():
    assert extract_amount_from_text("Paid rs 450 for cab") == 450.0
    assert extract_amount_from_text("Dinner ₹1,250.50 at Taj") == 1250.50
    assert extract_amount_from_text("500 rs auto rickshaw") == 500.0
    assert extract_amount_from_text("inr 3500 flight ticket") == 3500.0
    assert extract_amount_from_text("No amount mentioned here") is None


def test_create_failed_draft():
    svc = ExtractionService()
    aid = uuid.uuid4()
    draft = svc._create_failed_draft(
        attachment_ids=[aid],
        notices=["Extraction timed out."],
    )

    assert draft["status"] == "failed"
    assert draft["fields"]["amount_minor"] is None
    assert draft["fields"]["merchant"] is None
    assert draft["fields"]["category"] == "other"
    assert draft["attachment_ids"] == [str(aid)]
    assert "Extraction timed out." in draft["notices"]


def test_verify_and_construct_draft_valid():
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[
            PerFileClassification(
                file_index=0,
                document_type="bill",
                is_receipt=True,
            )
        ],
        merchant="Uber India",
        date="2026-10-28",
        total_amount=450.0,
        currency="INR",
        suggested_category="cab_local_transport",
        reason_suggestion="Cab to client office",
        confidence=FieldConfidence(
            amount=0.95,
            date=0.90,
            merchant=0.95,
            category=0.90,
            reason=0.85,
        ),
        cross_checks=CrossChecks(
            amount=CrossCheckStatus.MATCH,
            payee=CrossCheckStatus.MATCH,
            date=CrossCheckStatus.MATCH,
        ),
    )

    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[uuid.uuid4()],
        today_str="2026-10-28",
    )

    assert draft["status"] == "ok"
    assert draft["fields"]["amount_minor"] == 45000  # 450.0 * 100 paise
    assert draft["fields"]["merchant"] == "Uber India"
    assert draft["fields"]["category"] == "cab_local_transport"
    assert draft["receipt_type"] == "bill_photo"
    assert len(draft["notices"]) == 0
    assert draft["line_items"] == []
    assert draft["line_items_total"] is None


def test_verify_itemized_bill_keeps_ten_line_items():
    """A ten-entry bill keeps every row and reconciles exactly."""
    svc = ExtractionService()
    items = [
        LineItem(description=f"Menu item {index + 1}", amount=10.0)
        for index in range(10)
    ]
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="The Grill House",
        date="2026-10-28",
        subtotal=100.0,
        tax_amount=20.0,
        total_amount=120.0,
        currency="INR",
        line_items=items,
        suggested_category="client_meals_entertainment",
        reason_suggestion="Client dinner",
        confidence=FieldConfidence(amount=0.95),
    )

    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[],
        today_str="2026-10-28",
    )

    assert draft["status"] == "ok"
    assert len(draft["line_items"]) == 10
    assert draft["line_items"][0]["description"] == "Menu item 1"
    assert draft["line_items"][-1]["amount_minor"] == 1000
    assert draft["line_items_total"] == 100.0
    assert not any("Line items add up" in notice for notice in draft["notices"])


def test_verify_line_item_total_mismatch_flags_amount():
    """A line-item sum that disagrees with the bill lowers confidence."""
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="The Grill House",
        date="2026-10-28",
        subtotal=100.0,
        total_amount=120.0,
        currency="INR",
        line_items=[
            LineItem(description="Item one", amount=40.0),
            LineItem(description="Item two", amount=50.0),
        ],
        confidence=FieldConfidence(amount=0.95),
    )

    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[],
        today_str="2026-10-28",
    )

    assert draft["status"] == "partial"
    assert draft["confidence"]["amount"] <= 0.55
    assert any("Line items add up to ₹90.00" in n for n in draft["notices"])


def test_verify_line_items_supply_missing_total():
    """When the grand total is cropped, the itemized sum pre-fills the amount."""
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="Corner Cafe",
        date="2026-10-28",
        total_amount=None,
        currency="INR",
        line_items=[
            LineItem(description="Coffee", amount=120.0),
            LineItem(description="Sandwich", amount=180.0),
        ],
        confidence=FieldConfidence(amount=0.2),
    )

    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[],
        today_str="2026-10-28",
    )

    assert draft["fields"]["amount_minor"] == 30000
    assert draft["confidence"]["amount"] <= 0.75
    assert any("No grand total was visible" in n for n in draft["notices"])


def test_verify_line_items_keep_unreadable_rows():
    """An unreadable line amount stays visible instead of disappearing."""
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="Corner Cafe",
        date="2026-10-28",
        total_amount=100.0,
        currency="INR",
        line_items=[
            LineItem(description="Smudged item", amount=None),
            LineItem(description="Readable item", amount=100.0),
        ],
    )

    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[],
        today_str="2026-10-28",
    )

    assert len(draft["line_items"]) == 2
    assert draft["line_items"][0]["description"] == "Smudged item"
    assert draft["line_items"][0]["amount_minor"] is None
    assert any("Some line-item amounts were unreadable" in n for n in draft["notices"])


def test_verify_subtotal_tax_mismatch_notice():
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="Blue Tokai Coffee",
        date="2026-10-28",
        subtotal=200.0,
        tax_amount=20.0,
        total_amount=300.0,  # 200 + 20 != 300
        currency="INR",
        confidence=FieldConfidence(amount=0.9),
    )

    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[],
        today_str="2026-10-28",
    )

    assert any("does not match subtotal + tax" in n for n in draft["notices"])
    assert draft["confidence"]["amount"] <= 0.5  # Penalized


def test_verify_future_date_reset():
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="Taj Hotel",
        date="2099-01-01",  # Future date
        total_amount=5000.0,
        currency="INR",
        confidence=FieldConfidence(date=0.9),
    )

    today_str = "2026-10-28"
    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[],
        today_str=today_str,
    )

    assert draft["fields"]["expense_date"] == today_str
    assert any("in the future" in n for n in draft["notices"])


def test_verify_typed_note_amount_override():
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="Quick Bite",
        date="2026-10-28",
        total_amount=250.0,
        currency="INR",
        confidence=FieldConfidence(amount=0.8),
    )

    # User note mentions ₹500
    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note="Actually split bill was rs 500",
        attachment_ids=[],
        today_str="2026-10-28",
    )

    assert draft["fields"]["amount_minor"] == 50000  # ₹500 applied
    assert any("Typed note amount applied" in c for c in draft["conflicts"])


def test_verify_foreign_currency_notice():
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="Starbucks NYC",
        date="2026-10-28",
        total_amount=15.0,
        currency="USD",
        confidence=FieldConfidence(amount=0.8),
    )

    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[],
        today_str="2026-10-28",
    )

    assert any("Foreign currency detected (USD)" in n for n in draft["notices"])


def test_verify_multiple_bills_warning():
    svc = ExtractionService()
    extraction = GeminiReceiptExtraction(
        files=[],
        merchant="Multiple Store",
        total_amount=100.0,
        looks_like_multiple_bills=True,
    )

    draft = svc._verify_and_construct_draft(
        extracted=extraction,
        note=None,
        attachment_ids=[],
        today_str="2026-10-28",
    )

    assert any("different bills" in n for n in draft["notices"])
