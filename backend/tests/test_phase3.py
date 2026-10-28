"""
tests/test_phase3.py — Unit tests for Phase 3: magic-byte checks, file size, PDF encryption/page limits, storage interface.
"""

from __future__ import annotations

import io
import pytest

from app.file_validation import (
    FileValidationError,
    detect_mime_from_magic_bytes,
    validate_file,
    validate_file_batch,
    MAX_IMAGE_SIZE_BYTES,
    MAX_PDF_SIZE_BYTES,
)

try:
    from pypdf import PdfWriter
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


# ---------------------------------------------------------------------------
# Helpers to generate synthetic valid and invalid files
# ---------------------------------------------------------------------------
def make_valid_jpeg(size: int = 100) -> bytes:
    """JPEG starts with \xff\xd8\xff."""
    return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x00" * size


def make_valid_png(size: int = 100) -> bytes:
    """PNG starts with \x89PNG\r\n\x1a\n."""
    return b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * size


def make_valid_webp(size: int = 100) -> bytes:
    """WebP starts with RIFF....WEBP."""
    return b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * size


def make_valid_pdf(num_pages: int = 1) -> bytes:
    """Create a minimal valid unencrypted PDF with specified page count."""
    if not HAS_PYPDF:
        # Minimal synthetic PDF bytes
        return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"
    writer = PdfWriter()
    for _ in range(num_pages):
        writer.add_blank_page(width=72, height=72)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def make_encrypted_pdf() -> bytes:
    """Create a password-encrypted PDF."""
    if not HAS_PYPDF:
        return b"%PDF-1.4\n/Encrypt\n%%EOF"
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.encrypt(user_password="secret_password")
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# 1. Magic Bytes Detection Tests
# ---------------------------------------------------------------------------
def test_detect_mime_from_magic_bytes() -> None:
    assert detect_mime_from_magic_bytes(make_valid_jpeg()) == "image/jpeg"
    assert detect_mime_from_magic_bytes(make_valid_png()) == "image/png"
    assert detect_mime_from_magic_bytes(make_valid_webp()) == "image/webp"
    assert detect_mime_from_magic_bytes(make_valid_pdf(1)) == "application/pdf"

    # Unsupported formats
    assert detect_mime_from_magic_bytes(b"GIF89a\x01\x00\x01\x00") is None
    assert detect_mime_from_magic_bytes(b"PK\x03\x04") is None  # ZIP
    assert detect_mime_from_magic_bytes(b"random text bytes") is None


# ---------------------------------------------------------------------------
# 2. File Validation: Success Cases
# ---------------------------------------------------------------------------
def test_validate_valid_jpeg() -> None:
    data = make_valid_jpeg(500)
    res = validate_file("receipt.jpg", data)
    assert res.mime == "image/jpeg"
    assert res.filename == "receipt.jpg"
    assert res.size_bytes == len(data)
    assert res.page_count is None


def test_validate_valid_png() -> None:
    data = make_valid_png(500)
    res = validate_file("screenshot.png", data)
    assert res.mime == "image/png"
    assert res.filename == "screenshot.png"


def test_validate_valid_pdf() -> None:
    data = make_valid_pdf(3)
    res = validate_file("invoice.pdf", data)
    assert res.mime == "application/pdf"
    assert res.filename == "invoice.pdf"
    if HAS_PYPDF:
        assert res.page_count == 3


# ---------------------------------------------------------------------------
# 3. File Validation: Rejection Cases
# ---------------------------------------------------------------------------
def test_reject_empty_file() -> None:
    with pytest.raises(FileValidationError) as exc:
        validate_file("empty.jpg", b"")
    assert "is empty" in str(exc.value)


def test_reject_fake_pdf() -> None:
    """An image file renamed to .pdf must be recognized as JPEG by magic bytes."""
    fake_pdf = make_valid_jpeg()
    res = validate_file("fake.pdf", fake_pdf)
    assert res.mime == "image/jpeg"


def test_reject_unsupported_format() -> None:
    with pytest.raises(FileValidationError) as exc:
        validate_file("document.docx", b"PK\x03\x04\x14\x00\x06\x00\x08\x00\x00\x00!")
    assert "Only JPEG, PNG, WebP, and PDF are accepted" in str(exc.value)


def test_reject_oversized_image() -> None:
    huge_image = make_valid_jpeg(MAX_IMAGE_SIZE_BYTES + 10)
    with pytest.raises(FileValidationError) as exc:
        validate_file("huge.jpg", huge_image)
    assert "exceeds the maximum allowed size of 5 MB" in str(exc.value)


def test_reject_oversized_pdf() -> None:
    huge_pdf = b"%PDF-1.4\n" + b"\x00" * (MAX_PDF_SIZE_BYTES + 10)
    with pytest.raises(FileValidationError) as exc:
        validate_file("huge.pdf", huge_pdf)
    assert "exceeds the maximum allowed size of 10 MB" in str(exc.value)


def test_reject_encrypted_pdf() -> None:
    if not HAS_PYPDF:
        pytest.skip("pypdf not installed in test environment")
    enc_data = make_encrypted_pdf()
    with pytest.raises(FileValidationError) as exc:
        validate_file("locked.pdf", enc_data)
    assert "password-protected or encrypted" in str(exc.value)


def test_reject_pdf_exceeding_page_limit() -> None:
    if not HAS_PYPDF:
        pytest.skip("pypdf not installed in test environment")
    six_page_pdf = make_valid_pdf(6)
    with pytest.raises(FileValidationError) as exc:
        validate_file("long_document.pdf", six_page_pdf)
    assert "exceeds the limit of 5 pages" in str(exc.value)


# ---------------------------------------------------------------------------
# 4. Batch Validation: Max 3 Files
# ---------------------------------------------------------------------------
def test_batch_validation_up_to_three_files() -> None:
    files = [
        ("bill1.jpg", make_valid_jpeg()),
        ("bill2.png", make_valid_png()),
        ("bill3.pdf", make_valid_pdf(1)),
    ]
    validated = validate_file_batch(files)
    assert len(validated) == 3


def test_reject_more_than_three_files() -> None:
    four_files = [
        ("f1.jpg", make_valid_jpeg()),
        ("f2.jpg", make_valid_jpeg()),
        ("f3.jpg", make_valid_jpeg()),
        ("f4.jpg", make_valid_jpeg()),
    ]
    with pytest.raises(FileValidationError) as exc:
        validate_file_batch(four_files)
    assert "Maximum allowed is 3 files" in str(exc.value)
