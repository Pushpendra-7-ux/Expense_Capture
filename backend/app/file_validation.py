"""
app/file_validation.py — File validation rules for Expense Capture (OPE).

Enforces:
1. Magic bytes: JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (RIFF....WEBP), PDF (%PDF-)
2. Size: <= 5 MB per image, <= 10 MB per PDF
3. PDF safety: <= 5 pages, reject encrypted/password-protected PDFs
4. Never render or execute PDFs server-side
"""

from __future__ import annotations

import io
from dataclasses import dataclass

try:
    from pypdf import PdfReader
    _HAS_PYPDF = True
except ImportError:
    PdfReader = None
    _HAS_PYPDF = False

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024    # 10 MB
MAX_PDF_PAGES = 5
MAX_FILES = 3


class FileValidationError(ValueError):
    """Raised when an uploaded file fails validation."""
    pass


@dataclass
class ValidatedFile:
    filename: str
    file_bytes: bytes
    mime: str
    size_bytes: int
    page_count: int | None = None


def detect_mime_from_magic_bytes(data: bytes) -> str | None:
    """Detect allowed MIME type strictly by file header magic bytes."""
    if len(data) < 12:
        return None

    # JPEG: FF D8 FF
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    # PNG: 89 50 4E 47 0D 0A 1A 0A
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    # WebP: RIFF....WEBP
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"

    # PDF: %PDF-
    if data.startswith(b"%PDF-"):
        return "application/pdf"

    return None


def validate_file(filename: str, file_bytes: bytes) -> ValidatedFile:
    """
    Validate a single file:
    - Check magic bytes
    - Check size limits
    - For PDF: inspect page count and encryption status via pypdf (no execution/rendering)
    """
    if not file_bytes:
        raise FileValidationError(f"File '{filename}' is empty.")

    mime = detect_mime_from_magic_bytes(file_bytes)
    if mime is None:
        raise FileValidationError(
            f"File '{filename}' has an unsupported format. Only JPEG, PNG, WebP, and PDF are accepted."
        )

    file_size = len(file_bytes)

    # Size and content checks
    if mime == "application/pdf":
        if file_size > MAX_PDF_SIZE_BYTES:
            raise FileValidationError(
                f"PDF '{filename}' exceeds the maximum allowed size of 10 MB ({file_size / (1024*1024):.1f} MB)."
            )

        # Inspect PDF page count & encryption if pypdf is available
        if _HAS_PYPDF and PdfReader is not None:
            try:
                reader = PdfReader(io.BytesIO(file_bytes))
                if reader.is_encrypted:
                    raise FileValidationError(
                        f"PDF '{filename}' is password-protected or encrypted. Please upload an unlocked PDF."
                    )

                page_count = len(reader.pages)
                if page_count > MAX_PDF_PAGES:
                    raise FileValidationError(
                        f"PDF '{filename}' has {page_count} pages, which exceeds the limit of {MAX_PDF_PAGES} pages."
                    )
                if page_count == 0:
                    raise FileValidationError(f"PDF '{filename}' contains no readable pages.")

                return ValidatedFile(
                    filename=filename,
                    file_bytes=file_bytes,
                    mime=mime,
                    size_bytes=file_size,
                    page_count=page_count,
                )
            except FileValidationError:
                raise
            except Exception as e:
                raise FileValidationError(f"Could not read PDF '{filename}': {str(e)}")
        else:
            # Fallback when pypdf is not installed in local environment
            return ValidatedFile(
                filename=filename,
                file_bytes=file_bytes,
                mime=mime,
                size_bytes=file_size,
                page_count=1,
            )

    else:
        # Image checks
        if file_size > MAX_IMAGE_SIZE_BYTES:
            raise FileValidationError(
                f"Image '{filename}' exceeds the maximum allowed size of 5 MB ({file_size / (1024*1024):.1f} MB)."
            )

        return ValidatedFile(
            filename=filename,
            file_bytes=file_bytes,
            mime=mime,
            size_bytes=file_size,
            page_count=None,
        )


def validate_file_batch(files: list[tuple[str, bytes]]) -> list[ValidatedFile]:
    """Validate a batch of files (0 to 3 files)."""
    if len(files) > MAX_FILES:
        raise FileValidationError(
            f"Too many files attached ({len(files)}). Maximum allowed is {MAX_FILES} files per submission."
        )

    validated = []
    for fname, fbytes in files:
        validated.append(validate_file(fname, fbytes))
    return validated
