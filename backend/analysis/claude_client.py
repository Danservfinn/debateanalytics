"""
Claude API client for debate analysis
"""

import json
import re
import time
import ssl
import logging
import urllib.request
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)


class ClaudeClient:
    """
    Wrapper for Anthropic Claude API calls.

    Supports both official SDK and direct HTTP API.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ):
        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.client = None
        self.use_sdk = False

        # Try to use official SDK
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=api_key)
            self.use_sdk = True
            logger.info(f"Using Anthropic SDK with model: {model}")
        except ImportError:
            logger.info("Anthropic SDK not found, using direct HTTP API")

    def chat(
        self,
        messages: List[Dict],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        Make a chat completion call to Claude.

        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Override default temperature
            max_tokens: Override default max tokens

        Returns:
            Response text from Claude
        """
        temp = temperature if temperature is not None else self.temperature
        tokens = max_tokens if max_tokens is not None else self.max_tokens

        if self.use_sdk:
            return self._sdk_call(messages, temp, tokens)
        else:
            return self._http_call(messages, temp, tokens)

    def _sdk_call(
        self,
        messages: List[Dict],
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Use official Anthropic SDK"""
        # Extract system message
        system_content = None
        user_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                user_messages.append(msg)

        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_content if system_content else "",
            messages=user_messages,
            temperature=temperature,
        )
        return response.content[0].text

    def _http_call(
        self,
        messages: List[Dict],
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Direct HTTP API call (fallback)"""
        try:
            import certifi
            ssl_context = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            ssl_context = ssl.create_default_context()

        url = "https://api.anthropic.com/v1/messages"

        # Extract system message
        system_content = None
        user_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                user_messages.append(msg)

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": user_messages,
            "temperature": temperature,
        }
        if system_content:
            payload["system"] = system_content

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")

        max_retries = 3
        base_delay = 2

        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, context=ssl_context, timeout=180) as response:
                    result = json.loads(response.read().decode("utf-8"))
                    return result["content"][0]["text"]
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"Rate limited, waiting {delay}s...")
                    time.sleep(delay)
                    continue
                else:
                    error_body = e.read().decode() if e.fp else str(e)
                    logger.error(f"HTTP Error: {e.code} - {error_body}")
                    raise
            except Exception as e:
                logger.error(f"API Error: {e}")
                raise

        raise Exception("Max retries exceeded")

    def parse_json_response(self, response: str) -> Dict:
        """
        Extract JSON from Claude's response.

        Handles markdown code blocks and common formatting issues.
        """
        # Try to find JSON in code blocks
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response)
        if json_match:
            response = json_match.group(1)

        # Clean common issues
        response = response.strip()
        if not response.startswith("{") and not response.startswith("["):
            # Find first { or [
            start = min(
                response.find("{") if response.find("{") != -1 else len(response),
                response.find("[") if response.find("[") != -1 else len(response),
            )
            if start < len(response):
                response = response[start:]

        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.debug(f"Response: {response[:500]}...")
            return {}

    def analyze(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
    ) -> Dict:
        """
        Convenience method for analysis calls.

        Args:
            system_prompt: System context
            user_prompt: User query
            temperature: Optional temperature override

        Returns:
            Parsed JSON response
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = self.chat(messages, temperature=temperature)
        return self.parse_json_response(response)
