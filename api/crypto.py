"""
MCP Registry — GitHub Token 暗号化ユーティリティ

AES-256-GCM を使用してトークンを暗号化・復号する。
マスターキーは環境変数 TOKEN_ENCRYPTION_KEY (hex 64文字 = 32バイト) で指定する。

使用例:
    enc = encrypt_token("ghp_xxxx")
    tok = decrypt_token(enc)
"""
from __future__ import annotations

import base64
import os
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# 環境変数からマスターキーを取得（hex 64文字 = 32バイト）
_RAW_KEY = os.environ.get("TOKEN_ENCRYPTION_KEY", "")

# キーが未設定の場合は起動のたびにランダムキーを生成（再起動後は復号不可）
# 本番では必ず TOKEN_ENCRYPTION_KEY を設定すること
if _RAW_KEY:
    try:
        _MASTER_KEY: bytes = bytes.fromhex(_RAW_KEY)
        if len(_MASTER_KEY) != 32:
            raise ValueError("TOKEN_ENCRYPTION_KEY は 64文字の hex 文字列 (32バイト) でなければなりません")
    except ValueError as e:
        raise RuntimeError(f"TOKEN_ENCRYPTION_KEY が不正です: {e}") from e
else:
    import logging
    logging.getLogger(__name__).warning(
        "TOKEN_ENCRYPTION_KEY が未設定です。再起動後に既存の暗号化トークンを復号できなくなります。"
        " 本番環境では必ず .env に TOKEN_ENCRYPTION_KEY を設定してください。"
    )
    _MASTER_KEY = secrets.token_bytes(32)


def encrypt_token(plaintext: str) -> str:
    """
    トークンを AES-256-GCM で暗号化し、Base64 URL-safe 文字列として返す。
    フォーマット: base64url(nonce[12] + ciphertext + tag[16])
    """
    if not plaintext:
        return ""
    aesgcm = AESGCM(_MASTER_KEY)
    nonce = secrets.token_bytes(12)  # GCM 推奨: 96bit nonce
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt_token(encoded: str) -> str:
    """
    encrypt_token() で暗号化された文字列を復号して返す。
    復号失敗時は空文字列を返す（ログは呼び出し元で記録する）。
    """
    if not encoded:
        return ""
    try:
        raw = base64.urlsafe_b64decode(encoded.encode("ascii"))
        nonce, ciphertext = raw[:12], raw[12:]
        aesgcm = AESGCM(_MASTER_KEY)
        return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
    except Exception:
        return ""
