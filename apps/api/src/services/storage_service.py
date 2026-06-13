from __future__ import annotations

from pathlib import Path

import boto3
from botocore.config import Config

from src.config import Settings


class StorageService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None

    def is_configured(self) -> bool:
        return bool(
            self.settings.S3_ENDPOINT
            and self.settings.S3_REGION
            and self.settings.S3_BUCKET
            and self.settings.S3_ACCESS_KEY
            and self.settings.S3_SECRET_KEY
        )

    @property
    def client(self):
        if not self.is_configured():
            raise RuntimeError("S3 storage is not configured")
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=self.settings.S3_ENDPOINT,
                region_name=self.settings.S3_REGION,
                aws_access_key_id=self.settings.S3_ACCESS_KEY,
                aws_secret_access_key=self.settings.S3_SECRET_KEY,
                config=Config(
                    connect_timeout=5,
                    read_timeout=20,
                    retries={"max_attempts": 2, "mode": "standard"},
                    signature_version="s3v4",
                ),
            )
        return self._client

    def upload_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.settings.S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    def upload_file(self, key: str, path: str, content_type: str) -> None:
        self.client.upload_file(
            Filename=str(Path(path)),
            Bucket=self.settings.S3_BUCKET,
            Key=key,
            ExtraArgs={"ContentType": content_type},
        )

    def generate_presigned_url(self, key: str, expires: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.settings.S3_BUCKET, "Key": key},
            ExpiresIn=expires,
        )

