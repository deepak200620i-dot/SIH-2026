# IBVAP — Security, Blockchain & Behavior Analytics Architecture

## 1. Executive Summary

The **Intelligent Border Video Analytics Platform (IBVAP)** incorporates a zero-trust cybersecurity posture, tamper-evident cryptographic evidence management, multi-tier role-based access control (RBAC), immutable audit trails, and pluggable blockchain notarization alongside real-time trajectory behavior analysis — all without impairing real-time edge AI inference throughput.

---

## 2. Authentication & Authorization Model

### Authentication
- **Mechanism**: JWT (JSON Web Tokens) with HMAC-SHA256 (`HS256`).
- **Password Storage**: One-way salting and hashing using `bcrypt` (72-byte safe truncation, auto-generated salt).
- **Session Lifecycle**: 120-minute operational window with token validation on every restricted REST call and WebSocket handshake.
- **Header Format**: `Authorization: Bearer <token>`.

### RBAC Matrix

| Role | Description | Permissions |
|---|---|---|
| **ADMIN** | Full administrative and security authority | Manage cameras, edit fence zones, face enrollment, view & retry ledger sync, full audit log access, system configuration |
| **OPERATOR** | Border patrol / tactical surveillance operations | Live video monitoring, camera viewing, alert acknowledgment, manual evidence verification |
| **AUDITOR** | Independent compliance & forensics officer | Read-only event feed, evidence viewing, SHA-256 integrity checks, audit log inspection, ledger verification |

---

## 3. Evidence Integrity & Cryptographic Chain of Custody

### Lifecycle & Verification Flow
```
Camera / Frame 
  → Detection & Rule Engine 
  → Snapshot Saved to Disk
  → SHA-256 Hash Computed (Exact file bytes)
  → PostgreSQL Insert (integrity_status = 'PENDING')
  → WebSocket Broadcast
  → Background Ledger Queue (Non-blocking)
  → Ledger Notarization & ID Recorded
```

### Integrity Verification States
- `PENDING`: Evidence captured and registered, initial baseline check pending.
- `VERIFIED`: Recomputed SHA-256 hash matches the database baseline hash bit-for-bit.
- `FAILED`: Hash mismatch detected — indicates post-incident tampering or bitrot.
- `NOT_AVAILABLE`: Snapshot file missing or hash uninitialized.

### Authenticated Evidence Delivery
Unauthenticated direct static file exposure (`/static/evidence`) has been replaced by the authenticated `/api/evidence/{filename}` endpoint, which enforces valid JWT credentials, role verification, and automatically logs `VIEW_EVIDENCE` audit records.

---

## 4. Blockchain & Distributed Ledger Integration

### Ledger Service Architecture
IBVAP uses a modular adapter architecture (`src/security/blockchain/`):
- **Facade**: `src/security/blockchain/service.py` provides uniform methods (`register_event`, `get_record`, `verify_record`).
- **Local Demo Ledger**: `LocalDemoLedger` (`src/security/blockchain/local_adapter.py`) writes deterministic, tamper-evident chained records to `data/ledger/local_demo_ledger.json`.
- **Hyperledger Fabric**: `HyperledgerFabricAdapter` (`src/security/blockchain/fabric_adapter.py`) provides enterprise Hyperledger Fabric chaincode endpoints.
- **Provider Switching**: Controlled via environment variable `LEDGER_PROVIDER` (`LOCAL_DEMO` or `HYPERLEDGER_FABRIC`).

### Non-Blocking Asynchronous Processing
To guarantee zero frame drops and maintain high FPS, ledger transactions are queued to asynchronous background workers (`src/security/blockchain/background.py`). Video pipeline execution is never blocked waiting for block generation or network consensus.

---

## 5. Audit Logging Architecture

Every security-sensitive operation creates an immutable audit record in PostgreSQL (`audit_logs` table):
- **Captured Fields**: `id`, `actor_user_id`, `action`, `target_type`, `target_id`, `timestamp`, `result`, `metadata_json`, `ip_address`.
- **Logged Actions**:
  - `LOGIN_SUCCESS`, `LOGIN_FAILURE`
  - `VIEW_EVIDENCE`, `ACKNOWLEDGE_EVENT`
  - `MODIFY_ZONE`, `ADD_CAMERA`, `REMOVE_CAMERA`
  - `FACE_ENROLL`, `FACE_DELETE`
  - `INTEGRITY_VERIFY`, `LEDGER_REGISTER`, `ADMIN_ACTION`
- **Data Privacy**: Passwords, plaintext tokens, private keys, and raw biometric face embeddings are strictly scrubbed from audit logs.

---

## 6. Trajectory-Based Behavior Analytics

Implemented in `src/rules/behavior_analytics.py`, this module analyzes ByteTrack object centroids and motion vectors over time without demanding heavy deep-learning compute:

| Anomaly Type | Detection Method | Default Config Threshold |
|---|---|---|
| **Direction Violation** | Motion vector angle vs. permitted zone vector | Angle deviation > 45° after min 30px displacement |
| **Repeated Entry** | Track ID entering same zone polygon multiple times | > 3 entries within 30-minute rolling window |
| **Crowding** | Real-time concurrent person count inside zone polygon | > 5 persons simultaneously in zone |
| **Rapid Movement** | Centroid euclidean distance / elapsed frame time | > 200 px/sec sustained velocity |
| **Abnormal Dwell** | Prolonged track presence beyond loitering limit | > 3.0x base dwell multiplier (180s) |

---

## 7. Configuration & Environment Variables

| Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | Hosted Supabase PostgreSQL connection string | `postgresql://postgres:...@db...supabase.co:5432/postgres` |
| `JWT_SECRET` | Secret key for signing authentication tokens | 256-bit high-entropy secret |
| `IBVAP_ADMIN_PASSWORD` | Seed password for default admin user | Configurable, e.g. `Admin@123` |
| `CORS_ORIGINS` | Comma-separated whitelist of allowed web origins | `http://localhost:5173,http://localhost:3000` |
| `LEDGER_PROVIDER` | Active ledger implementation | `LOCAL_DEMO` or `HYPERLEDGER_FABRIC` |
