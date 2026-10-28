"""
app/gemini_schemas.py — Pydantic schemas for Gemini Structured Output.

These schemas define the exact JSON structure returned by the Gemini Flash model.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    BILL = "bill"
    PAYMENT_SCREENSHOT = "payment_screenshot"
    SUPPORTING = "supporting"
    OTHER = "other"


class CrossCheckStatus(str, Enum):
    MATCH = "match"
    MISMATCH = "mismatch"
    UNCLEAR = "unclear"
    NOT_APPLICABLE = "not_applicable"


class CrossChecks(BaseModel):
    amount: CrossCheckStatus = Field(
        default=CrossCheckStatus.NOT_APPLICABLE,
        description="Whether amounts across files/screenshots match."
    )
    payee: CrossCheckStatus = Field(
        default=CrossCheckStatus.NOT_APPLICABLE,
        description="Whether payee/merchant across files match."
    )
    date: CrossCheckStatus = Field(
        default=CrossCheckStatus.NOT_APPLICABLE,
        description="Whether transaction dates across files match."
    )


class FieldConfidence(BaseModel):
    amount: float = Field(default=0.8, ge=0.0, le=1.0)
    date: float = Field(default=0.8, ge=0.0, le=1.0)
    merchant: float = Field(default=0.8, ge=0.0, le=1.0)
    category: float = Field(default=0.8, ge=0.0, le=1.0)
    reason: float = Field(default=0.8, ge=0.0, le=1.0)


class LineItem(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None


class PerFileClassification(BaseModel):
    file_index: int = Field(description="0-based index of the file in the request.")
    document_type: DocumentType = Field(
        description="Classification: bill | payment_screenshot | supporting | other"
    )
    is_receipt: bool = Field(
        description="True if this file is a receipt or payment confirmation."
    )
    summary: Optional[str] = Field(
        default=None,
        description="Brief summary of document content."
    )


class GeminiReceiptExtraction(BaseModel):
    """
    Structured extraction schema passed to Gemini.
    """
    files: List[PerFileClassification] = Field(
        default_factory=list,
        description="Classification of each file passed in contents."
    )
    merchant: Optional[str] = Field(
        default=None,
        description="Primary merchant, store, or payee name (e.g. Uber, Swiggy, Starbucks)."
    )
    payee_name: Optional[str] = Field(
        default=None,
        description="Payee name if distinct from merchant (e.g. UPI beneficiary name)."
    )
    payment_app: Optional[str] = Field(
        default=None,
        description="App name if payment screenshot (e.g. Google Pay, PhonePe, Paytm, CRED)."
    )
    date: Optional[str] = Field(
        default=None,
        description="Transaction date in YYYY-MM-DD format."
    )
    total_amount: Optional[float] = Field(
        default=None,
        description="Grand total payable amount after taxes and discounts. Never a subtotal."
    )
    currency: Optional[str] = Field(
        default="INR",
        description="3-letter currency code (usually INR for Indian receipts)."
    )
    subtotal: Optional[float] = Field(
        default=None,
        description="Subtotal before taxes, if visible."
    )
    tax_amount: Optional[float] = Field(
        default=None,
        description="Total tax amount (e.g. CGST + SGST or IGST), if visible."
    )
    line_items: List[LineItem] = Field(
        default_factory=list,
        description="Visible individual line item amounts (used for code reconciliation)."
    )
    invoice_no: Optional[str] = Field(
        default=None,
        description="Invoice number, bill number, or receipt number."
    )
    txn_ref: Optional[str] = Field(
        default=None,
        description="UPI reference ID, bank transaction ID, or UTR number."
    )
    suggested_category: Optional[str] = Field(
        default="other",
        description="cab_local_transport | travel | client_meals_entertainment | team_meals | communication_data | office_supplies | other"
    )
    reason_suggestion: Optional[str] = Field(
        default=None,
        description="One-line purpose strictly from visible or typed text. Max 140 chars. Never invent purpose."
    )
    supporting_summary: Optional[str] = Field(
        default=None,
        description="Context extracted from supporting documents."
    )
    looks_like_multiple_bills: bool = Field(
        default=False,
        description="True if uploaded files appear to represent separate independent bills rather than one expense."
    )
    cross_checks: CrossChecks = Field(
        default_factory=CrossChecks,
        description="Cross checks across files."
    )
    confidence: FieldConfidence = Field(
        default_factory=FieldConfidence,
        description="Per-field confidence scores between 0.0 and 1.0."
    )
    notes: Optional[str] = Field(
        default=None,
        description="Notices such as pending/failed payment status, blurred portions, etc."
    )
