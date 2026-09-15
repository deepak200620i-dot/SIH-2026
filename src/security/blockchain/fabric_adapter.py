"""
IBVAP — Hyperledger Fabric Adapter (Stub)
==========================================
Placeholder adapter for real Hyperledger Fabric integration.
Implements the same interface as ``LocalDemoLedger``.
Requires actual Fabric SDK, peer endpoints, and chaincode deployment
to be functional.
"""

from __future__ import annotations

import os
from typing import Any, Optional


class HyperledgerFabricAdapter:
    """
    Hyperledger Fabric ledger adapter.
    Reads configuration from environment variables:
      - FABRIC_PEER_ENDPOINT
      - FABRIC_CHANNEL
      - FABRIC_CHAINCODE
      - FABRIC_MSP_ID
      - FABRIC_CERT_PATH
      - FABRIC_KEY_PATH
    """

    PROVIDER_NAME = "HYPERLEDGER_FABRIC"

    def __init__(self) -> None:
        self.peer_endpoint = os.getenv("FABRIC_PEER_ENDPOINT", "")
        self.channel = os.getenv("FABRIC_CHANNEL", "ibvap-channel")
        self.chaincode = os.getenv("FABRIC_CHAINCODE", "ibvap-evidence")
        self.msp_id = os.getenv("FABRIC_MSP_ID", "")
        self.cert_path = os.getenv("FABRIC_CERT_PATH", "")
        self.key_path = os.getenv("FABRIC_KEY_PATH", "")

    def register_event(
        self,
        event_id: int,
        camera_id: str,
        event_type: str,
        severity: str,
        timestamp: str,
        evidence_sha256: str,
    ) -> dict[str, Any]:
        """
        Submit event evidence hash to Fabric chaincode.
        Raises NotImplementedError until real Fabric SDK is integrated.
        """
        raise NotImplementedError(
            "Hyperledger Fabric adapter requires real Fabric SDK, "
            "peer endpoints, and deployed chaincode. "
            "Use LEDGER_PROVIDER=LOCAL_DEMO for development."
        )

    def get_record(self, event_id: int) -> Optional[dict[str, Any]]:
        """Query chaincode for an event record."""
        raise NotImplementedError(
            "Hyperledger Fabric adapter not yet connected."
        )

    def verify_record(self, event_id: int) -> dict[str, Any]:
        """Verify a record against the Fabric ledger."""
        raise NotImplementedError(
            "Hyperledger Fabric adapter not yet connected."
        )
