from pathlib import Path
from typing import Any, Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .config import WorkerConfig

DELETE_BATCH = 1000
NOT_FOUND_CODES = {"404", "NoSuchKey", "NotFound"}


class ObjectStorage(Protocol):
    """The few storage operations the worker needs (S3 compatible: Cloudflare R2 in production)."""

    def object_size(self, bucket: str, key: str) -> int | None: ...

    def download(self, bucket: str, key: str, destination: Path) -> None: ...

    def upload(
        self, bucket: str, key: str, source: Path, content_type: str, content_encoding: str | None, cache_control: str
    ) -> None: ...

    def delete(self, bucket: str, key: str) -> None: ...

    def delete_prefix(self, bucket: str, prefix: str) -> None: ...


class S3Storage:
    """ObjectStorage on top of boto3. The client is thread safe: the uploads of a game run in parallel."""

    def __init__(self, config: WorkerConfig) -> None:
        self._client: Any = boto3.client(
            "s3",
            endpoint_url=config.s3_endpoint,
            region_name=config.s3_region,
            aws_access_key_id=config.s3_access_key_id,
            aws_secret_access_key=config.s3_secret_access_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    def object_size(self, bucket: str, key: str) -> int | None:
        try:
            return int(self._client.head_object(Bucket=bucket, Key=key)["ContentLength"])
        except ClientError as error:
            if str(error.response.get("Error", {}).get("Code")) in NOT_FOUND_CODES:
                return None
            raise

    def download(self, bucket: str, key: str, destination: Path) -> None:
        self._client.download_file(bucket, key, str(destination))

    def upload(
        self, bucket: str, key: str, source: Path, content_type: str, content_encoding: str | None, cache_control: str
    ) -> None:
        extra: dict[str, str] = {"ContentType": content_type, "CacheControl": cache_control}
        if content_encoding:
            extra["ContentEncoding"] = content_encoding
        self._client.upload_file(str(source), bucket, key, ExtraArgs=extra)

    def delete(self, bucket: str, key: str) -> None:
        self._client.delete_object(Bucket=bucket, Key=key)

    def delete_prefix(self, bucket: str, prefix: str) -> None:
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            keys = [{"Key": item["Key"]} for item in page.get("Contents", [])]
            for start in range(0, len(keys), DELETE_BATCH):
                self._client.delete_objects(
                    Bucket=bucket, Delete={"Objects": keys[start : start + DELETE_BATCH], "Quiet": True}
                )
