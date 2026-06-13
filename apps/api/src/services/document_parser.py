from __future__ import annotations

import io
import mimetypes
import re
import unicodedata
from pathlib import Path
from typing import Protocol


ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}
ALLOWED_MIME_TYPES = {
    ".pdf": {"application/pdf", "application/octet-stream"},
    ".txt": {"text/plain", "application/octet-stream"},
    ".md": {"text/markdown", "text/plain", "application/octet-stream"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream",
    },
}
MAX_TEXT_CHARS = 80_000


class UploadLike(Protocol):
    filename: str | None
    content_type: str | None

    async def read(self, size: int = -1) -> bytes:
        ...


class DocumentValidationError(ValueError):
    pass


class DocumentParsingError(ValueError):
    pass


def safe_filename(filename: str | None) -> str:
    raw_name = Path(filename or "upload").name
    normalized = unicodedata.normalize("NFKD", raw_name).encode("ascii", "ignore").decode()
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", normalized).strip(".-")
    return normalized[:120] or "upload"


def validate_upload_metadata(filename: str | None, content_type: str | None) -> str:
    clean_name = safe_filename(filename)
    extension = Path(clean_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise DocumentValidationError(f"Unsupported file type. Allowed extensions: {allowed}")

    supplied_mime = (content_type or "").split(";")[0].strip().lower()
    guessed_mime = (mimetypes.guess_type(clean_name)[0] or "").lower()
    allowed_mimes = ALLOWED_MIME_TYPES[extension]
    if supplied_mime and supplied_mime not in allowed_mimes:
        raise DocumentValidationError("Unsupported MIME type for uploaded document")
    if guessed_mime and guessed_mime not in allowed_mimes:
        raise DocumentValidationError("File extension and MIME type do not match")
    return extension


async def read_upload_bytes(upload: UploadLike, max_bytes: int) -> bytes:
    validate_upload_metadata(upload.filename, upload.content_type)
    chunks: list[bytes] = []
    total = 0

    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise DocumentValidationError("Uploaded file exceeds the configured size limit")
        chunks.append(chunk)

    if total == 0:
        raise DocumentValidationError("Uploaded file is empty")
    return b"".join(chunks)


def extract_text(filename: str | None, data: bytes, content_type: str | None = None) -> str:
    extension = validate_upload_metadata(filename, content_type)
    if len(data) == 0:
        raise DocumentValidationError("Uploaded file is empty")

    if extension in {".txt", ".md"}:
        text = _decode_text(data)
    elif extension == ".pdf":
        text = _extract_pdf_text(data)
    elif extension == ".docx":
        text = _extract_docx_text(data)
    else:
        raise DocumentValidationError("Unsupported file type")

    text = _clean_text(text)
    if not text:
        raise DocumentParsingError("No readable text was found in the uploaded document")
    return text[:MAX_TEXT_CHARS]


def _decode_text(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise DocumentParsingError("Unable to decode text document")


def _extract_pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise DocumentParsingError("PDF parsing dependency is not installed") from exc

    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages[:40]]
        return "\n\n".join(pages)
    except Exception as exc:  # pypdf raises several parser-specific exceptions.
        raise DocumentParsingError("Unable to extract text from PDF") from exc


def _extract_docx_text(data: bytes) -> str:
    try:
        from docx import Document
    except ImportError as exc:
        raise DocumentParsingError("DOCX parsing dependency is not installed") from exc

    try:
        document = Document(io.BytesIO(data))
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        return "\n".join(paragraphs)
    except Exception as exc:
        raise DocumentParsingError("Unable to extract text from DOCX") from exc


def _clean_text(text: str) -> str:
    without_nulls = text.replace("\x00", " ")
    compact_lines = [re.sub(r"\s+", " ", line).strip() for line in without_nulls.splitlines()]
    return "\n".join(line for line in compact_lines if line)

