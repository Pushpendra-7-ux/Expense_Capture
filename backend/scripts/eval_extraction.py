#!/usr/bin/env python3
"""
backend/scripts/eval_extraction.py — Evaluation script for Gemini Flash extraction pipeline.

Usage:
    python backend/scripts/eval_extraction.py [--thinking low|high] [--samples-dir samples/]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.extraction_service import extraction_service
from app.file_validation import validate_file


async def run_eval(samples_dir: Path, thinking_level: str, model_name: str | None = None) -> None:
    expected_file = samples_dir / "expected.json"
    if not expected_file.exists():
        print(f"Error: {expected_file} does not exist.")
        sys.exit(1)

    with open(expected_file, "r", encoding="utf-8") as f:
        expectations = json.load(f)

    active_model = model_name or settings.GEMINI_MODEL

    print(f"\n=======================================================")
    print(f"  Expense Capture (OPE) — Gemini Extraction Eval")
    print(f"  Model: {active_model}")
    print(f"  Thinking Level: {thinking_level}")
    print(f"  Test Samples: {len(expectations)}")
    print(f"=======================================================\n")

    results = []
    total_time = 0.0

    for idx, exp in enumerate(expectations, start=1):
        filename = exp["filename"]
        file_path = samples_dir / filename

        print(f"[{idx}/{len(expectations)}] Testing: {filename}...")

        if not file_path.exists():
            print(f"  ⚠️  File {filename} not found on disk. Skipping file read.")
            results.append({
                "filename": filename,
                "status": "skipped",
                "error": "File not found",
            })
            continue

        with open(file_path, "rb") as bf:
            file_bytes = bf.read()

        try:
            val_file = validate_file(filename, file_bytes)
        except Exception as e:
            print(f"  ❌ File validation failed: {e}")
            results.append({
                "filename": filename,
                "status": "validation_error",
                "error": str(e),
            })
            continue

        start_t = time.monotonic()
        try:
            # Direct extraction call using the extraction service
            extracted_obj = await extraction_service._call_gemini_api(
                files_data=[(val_file.file_bytes, val_file.mime)],
                note=None,
                thinking_level=thinking_level,
                model_name=active_model,
            )
            elapsed = time.monotonic() - start_t
            total_time += elapsed

            draft = extraction_service._verify_and_construct_draft(
                extracted=extracted_obj,
                note=None,
                attachment_ids=[],
                today_str="2026-10-28",
            )

            # Compare fields
            fields = draft["fields"]
            amt_match = (
                fields["amount_minor"] == exp["expected_amount_minor"]
                if "expected_amount_minor" in exp
                else True
            )
            merchant_match = (
                exp["expected_merchant"].lower() in (fields["merchant"] or "").lower()
                if "expected_merchant" in exp
                else True
            )

            print(f"  ✅ Extracted in {elapsed:.2f}s:")
            print(f"     Amount: ₹{fields['amount_rupees']} (Expected paise: {exp.get('expected_amount_minor')}) -> Match: {amt_match}")
            print(f"     Merchant: '{fields['merchant']}' (Expected: '{exp.get('expected_merchant')}') -> Match: {merchant_match}")
            print(f"     Date: {fields['expense_date']}")
            print(f"     Category: {fields['category']}")

            results.append({
                "filename": filename,
                "status": "ok",
                "elapsed_s": round(elapsed, 2),
                "amt_match": amt_match,
                "merchant_match": merchant_match,
            })
        except Exception as e:
            elapsed = time.monotonic() - start_t
            print(f"  ❌ Extraction failed in {elapsed:.2f}s: {e}")
            results.append({
                "filename": filename,
                "status": "error",
                "elapsed_s": round(elapsed, 2),
                "error": str(e),
            })

    # Summary
    print("\n-------------------------------------------------------")
    print(f"Evaluation Complete in {total_time:.2f}s")
    ok_count = sum(1 for r in results if r["status"] == "ok")
    print(f"Successful: {ok_count}/{len(results)}")
    print("-------------------------------------------------------\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate Gemini receipt extraction.")
    parser.add_argument(
        "--thinking",
        choices=["low", "high"],
        default="low",
        help="Thinking level for Gemini 3 Flash (default: low)",
    )
    parser.add_argument(
        "--model",
        default=settings.GEMINI_MODEL,
        help=f"Gemini model ID to evaluate (default: {settings.GEMINI_MODEL})",
    )
    parser.add_argument(
        "--samples-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent.parent / "samples",
        help="Directory containing sample bills and expected.json",
    )

    args = parser.parse_args()
    asyncio.run(run_eval(args.samples_dir, args.thinking, args.model))


if __name__ == "__main__":
    main()
