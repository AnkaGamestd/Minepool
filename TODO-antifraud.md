# TODO: Anti-Fraud Settings for TAIN
**Created:** 2026-01-09
**Updated:** 2026-01-10
**Priority:** High

## Completed Tasks ✅

### 1. Rate Limiting ✅
- [x] Limit deposit verifications per user (max 10/hour)
- [x] Limit withdrawal requests per user (max 3/day)
- [x] Add cooldown between withdrawals (1 hour minimum)

### 2. Withdrawal Limits ✅
- [x] Daily withdrawal limit per user (10,000 TAIN/day)
- [x] Weekly withdrawal limit (50,000 TAIN/week)
- [x] Large withdrawal review threshold (> 5,000 TAIN requires manual approval)

### 3. Account Verification ✅
- [x] Minimum account age before withdrawals allowed (24 hours)
- [x] Minimum games played before first withdrawal (5 games)
- [ ] KYC for large withdrawals (optional - not implemented)

### 4. Transaction Monitoring ✅
- [x] Flag suspicious patterns (rapid deposits/withdrawals)
- [x] Alert on multiple accounts with same wallet
- [x] Log all transactions for audit trail

### 5. Game Integrity ✅
- [x] Server-side game state validation (min game duration)
- [x] Detect abnormal win rates (>85% after 20+ games)
- [x] Match duration validation (games <30s are flagged)

### 6. IP/Device Tracking ✅
- [x] Track user IP addresses
- [x] Detect multiple accounts from same IP (max 3)
- [ ] Fingerprint device for multi-account detection (optional)

## Admin API Endpoints

All endpoints require `X-Admin-Secret` header with ADMIN_SECRET value.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/antifraud/transactions` | GET | View audit log |
| `/api/admin/antifraud/suspicious` | GET | List flagged users |
| `/api/admin/antifraud/flag/:userId` | POST | Flag a user |
| `/api/admin/antifraud/unflag/:userId` | POST | Unflag a user |
| `/api/admin/antifraud/config` | GET | View current limits |

## Configuration (antifraud.js)

| Setting | Value |
|---------|-------|
| DEPOSIT_MAX_PER_HOUR | 10 |
| WITHDRAWAL_MAX_PER_DAY | 3 |
| WITHDRAWAL_COOLDOWN_HOURS | 1 |
| DAILY_WITHDRAWAL_LIMIT | 10,000 TAIN |
| WEEKLY_WITHDRAWAL_LIMIT | 50,000 TAIN |
| LARGE_WITHDRAWAL_THRESHOLD | 5,000 TAIN |
| MIN_ACCOUNT_AGE_HOURS | 24 |
| MIN_GAMES_FOR_WITHDRAWAL | 5 |
| MIN_GAME_DURATION_SECONDS | 30 |
| MAX_WIN_RATE_THRESHOLD | 85% |
| MAX_ACCOUNTS_PER_IP | 3 |

## Notes
- Treasury wallet: 0xdB6Be62B413dF944d5ABa396F352B8c90b0D0cb8
- TAIN contract: 0x3fe59e287f58e5a83443bcfd34dd72f045663e8b
- Add ADMIN_SECRET to Railway environment variables
