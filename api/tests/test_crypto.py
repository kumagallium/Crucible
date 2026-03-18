import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import secrets

import pytest

import crypto
from crypto import decrypt_token, encrypt_token


def test_roundtrip():
    token = "ghp_abc123XYZ"
    assert decrypt_token(encrypt_token(token)) == token


def test_empty_string_encrypt():
    assert encrypt_token("") == ""


def test_empty_string_decrypt():
    assert decrypt_token("") == ""


def test_nonce_randomness():
    token = "same_token"
    c1 = encrypt_token(token)
    c2 = encrypt_token(token)
    assert c1 != c2
    assert decrypt_token(c1) == token
    assert decrypt_token(c2) == token


def test_invalid_base64():
    assert decrypt_token("!!!not-valid-base64!!!") == ""


def test_tampered_ciphertext():
    enc = encrypt_token("ghp_secret")
    chars = list(enc)
    idx = len(chars) // 2
    chars[idx] = "A" if chars[idx] != "A" else "B"
    tampered = "".join(chars)
    assert decrypt_token(tampered) == ""


def test_wrong_key(monkeypatch):
    enc = encrypt_token("ghp_secret")
    wrong_key = secrets.token_bytes(32)
    monkeypatch.setattr(crypto, "_MASTER_KEY", wrong_key)
    assert decrypt_token(enc) == ""


def test_unicode_roundtrip():
    token = "日本語トークン_テスト_🔑"
    assert decrypt_token(encrypt_token(token)) == token


def test_long_token():
    token = "ghp_" + "x" * 10000
    assert decrypt_token(encrypt_token(token)) == token


def test_short_ciphertext():
    import base64

    short = base64.urlsafe_b64encode(b"tooshort").decode("ascii")
    assert decrypt_token(short) == ""
