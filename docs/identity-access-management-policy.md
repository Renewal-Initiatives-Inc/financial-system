# Identity and Access Management Policy

**Renewal Initiatives, Inc.**
A Massachusetts 501(c)(3) Nonprofit Corporation

**Effective Date:** February 17, 2026
**Last Reviewed:** February 17, 2026
**Next Review Date:** February 17, 2027
**Approved By:** Board of Directors
**Policy Owner:** Jeff Takle, Board Member & System Administrator

---

## 1. Purpose

This policy defines how Renewal Initiatives, Inc. ("the Organization") manages user identities, authentication, authorization, and access lifecycle for its financial management system and related services. It ensures that only authorized individuals can access organizational data, and that access is granted on a least-privilege basis proportionate to job responsibilities.

## 2. Scope

This policy applies to all individuals who access the Organization's financial management system, including:

- Staff members and employees
- Board members with system access
- Contractors or consultants performing authorized work
- Service accounts used for system-to-system integrations

## 3. Identity Provider

### 3.1 Centralized Identity Management

All user authentication is managed through **Zitadel Cloud**, a centralized identity and access management platform. Zitadel serves as the single source of truth for:

- User identities and profiles
- Authentication credentials and methods
- Role assignments and project grants
- Session management and token issuance

No local user accounts or passwords are stored in the financial management application itself.

### 3.2 Provider Security Posture

| Attribute | Detail |
|-----------|--------|
| Provider | Zitadel Cloud |
| Certifications | SOC 2 Type II, ISO 27001 |
| Protocol | OpenID Connect (OIDC) with PKCE |
| Data residency | Cloud-hosted with encryption at rest and in transit |
| Availability | Managed SLA with independent uptime from application |

## 4. Authentication

### 4.1 Authentication Protocol

- The application uses **OpenID Connect (OIDC)** for authentication, an industry-standard protocol built on OAuth 2.0
- The PKCE (Proof Key for Code Exchange) extension is used for all authentication flows, eliminating the need to store client secrets in the application
- Authentication state is verified via **state** and **PKCE** challenge parameters to prevent CSRF and authorization code interception attacks

### 4.2 Session Management

- User sessions are managed via **signed JSON Web Tokens (JWT)**
- JWTs are issued upon successful authentication and contain user identity and role claims
- Sessions expire automatically based on configured token lifetimes
- Session tokens are validated on every request by application middleware

### 4.3 Multi-Factor Authentication

MFA is enforced for all user accounts through the Zitadel identity provider. Supported second-factor methods:

| Method | Type | Status |
|--------|------|--------|
| TOTP authenticator apps (e.g., Google Authenticator, Authy) | Something you have | Supported and enforced |
| WebAuthn / FIDO2 security keys (e.g., YubiKey) | Something you have | Supported |

MFA enrollment is required during initial account setup. Users cannot access the financial system without completing MFA verification.

### 4.4 Authentication Enforcement

- Application middleware intercepts **every request** to protected routes and verifies the user's authentication status
- Unauthenticated requests are redirected to the centralized login page
- Only the following paths are excluded from authentication enforcement:
  - `/api/auth/*` — authentication callback endpoints (handled by NextAuth.js)
  - `/api/cron/*` — automated job endpoints (protected by secret-based authentication)
  - Static assets (`_next/static`, `_next/image`, `favicon.ico`)

## 5. Authorization

### 5.1 Role-Based Access Control (RBAC)

Access to the financial system is governed by role-based access control. Roles are assigned in Zitadel and communicated to the application via OIDC token claims.

#### Role Definitions

| Role | Zitadel Grant | Permissions |
|------|--------------|-------------|
| **Admin** | `admin` project role | Full access: view all data, create/edit transactions, manage accounts, configure settings, run imports, trigger syncs, manage bank connections |
| **User** | `app:finance` project role | Standard access: view financial data, create/edit transactions within assigned scope, generate reports |

#### Access Determination Flow

1. User authenticates via Zitadel OIDC
2. Zitadel includes project role claims in the ID token (`urn:zitadel:iam:org:project:roles`)
3. Application extracts roles during JWT callback
4. If user has neither `admin` nor `app:finance` role, **sign-in is denied entirely**
5. If user has a valid role, the appropriate permission level is stored in the session

### 5.2 Least Privilege

- Users are assigned the minimum role necessary for their job function
- Admin access is limited to the System Administrator and designated backup personnel
- New users default to the `user` role; admin promotion requires explicit action in Zitadel by an existing admin

### 5.3 Service Account Access

Service-to-service integrations use dedicated service accounts with scoped credentials:

| Integration | Authentication Method | Access Scope |
|-------------|----------------------|-------------|
| Plaid (bank feeds) | Client ID + Secret, AES-256-GCM encrypted access tokens | Read-only transaction sync |
| Ramp (corporate cards) | OAuth 2.0 client credentials | Read-only transaction retrieval |
| Postmark (email) | API key | Send-only transactional email |
| Neon (database) | Connection string with SSL | Application database access |
| App Portal (HR data) | Read-only database connection string | Employee records for payroll (read-only) |
| Cron jobs | `CRON_SECRET` bearer token | Scheduled task execution |

Service accounts do not have interactive login capabilities and cannot access the application UI.

## 6. Access Lifecycle

### 6.1 Provisioning (Onboarding)

1. System Administrator creates a new user account in Zitadel
2. Zitadel sends an invitation email to the new user with a link to set their password and enroll in MFA
3. System Administrator assigns the appropriate project role (`app:finance` or `admin`)
4. User completes password setup and MFA enrollment
5. User can now authenticate and access the financial system with their assigned permissions

### 6.2 Role Changes

1. System Administrator modifies the user's project role grant in Zitadel
2. Role change takes effect at the user's next authentication (JWT refresh)
3. System Administrator documents the change and reason

### 6.3 De-provisioning (Offboarding)

When a staff member leaves the organization or no longer requires access:

1. System Administrator **deactivates** the user account in Zitadel (immediate effect — user can no longer authenticate)
2. Existing sessions are invalidated at next token validation
3. If the departing individual had access to shared secrets or API keys, those credentials are rotated
4. De-provisioning is completed within **24 hours** of separation notification, or **immediately** for involuntary terminations
5. System Administrator logs the de-provisioning action and date

### 6.4 Access Reviews

| Review Activity | Frequency | Performed By |
|----------------|-----------|-------------|
| Active user list audit | Quarterly | System Administrator |
| Role assignment verification | Quarterly | System Administrator |
| Service account credential review | Annually | System Administrator |
| Inactive account identification | Quarterly | System Administrator |

During quarterly reviews, the System Administrator:
- Verifies each active account corresponds to a current staff member
- Confirms role assignments match current job responsibilities
- Identifies and deactivates accounts inactive for 90+ days
- Documents review completion and any actions taken

## 7. Password and Credential Policy

### 7.1 User Passwords

Password requirements are enforced by the Zitadel identity provider:

- Minimum length: 12 characters
- Complexity: Must include uppercase, lowercase, numbers, and special characters
- History: Cannot reuse previous 5 passwords
- Lockout: Account locked after 5 consecutive failed attempts

### 7.2 API Keys and Secrets

- API keys and integration secrets are stored in Vercel's encrypted environment variable store
- Secrets are never committed to source code or version control
- The `.env.example` file documents required variables without containing actual values
- API keys are rotated annually or immediately if compromise is suspected

### 7.3 Encryption Keys

- AES-256-GCM encryption keys (Plaid token encryption, employee PII encryption) are stored as environment variables
- Key rotation procedures are documented in the operations runbook
- Compromised keys trigger immediate rotation and re-encryption of affected data

## 8. Monitoring and Audit

### 8.1 Authentication Events

The following authentication events are logged by Zitadel:

- Successful logins (user, timestamp, IP address)
- Failed login attempts (user, timestamp, IP address, failure reason)
- MFA enrollment and verification events
- Account lockouts
- Password changes and resets
- Session creation and termination

### 8.2 Application Audit Log

All data-modifying actions within the financial system are recorded in an append-only audit log:

- **Fields captured:** User ID, action type, entity type, entity ID, before state, after state, timestamp
- **Integrity guarantee:** Audit log writes occur within the same database transaction as the action — if the audit write fails, the entire operation rolls back
- **Immutability:** The audit log table is append-only; no update or delete operations are permitted

### 8.3 Anomaly Detection

The System Administrator monitors for:

- Login attempts from unusual locations or IP addresses (via Zitadel audit logs)
- Multiple failed authentication attempts (potential brute force)
- Access attempts by deactivated accounts
- Unusual data access patterns (via application audit log)

## 9. Incident Response for Access-Related Events

| Event | Response |
|-------|----------|
| Compromised user credentials | Immediately deactivate account in Zitadel; force password reset; review audit logs for unauthorized actions |
| Compromised API key or secret | Immediately rotate the credential in Vercel; revoke old credential at the provider; review logs for unauthorized API calls |
| Compromised encryption key | Rotate key; re-encrypt affected data with new key; revoke and re-establish affected Plaid connections if necessary |
| Unauthorized access detected | Deactivate the account; preserve all logs; investigate scope of access; follow breach notification procedures per Information Security Policy |

## 10. Compliance

This policy supports compliance with:

- **201 CMR 17.00** (Massachusetts data security regulation) — access control requirements under 17.03(2)(b) and 17.04
- **IRS Publication 4557** — safeguarding taxpayer data for tax-exempt organizations
- **Plaid production access requirements** — identity and access management questionnaire

## 11. Related Documents

- [Information Security Policy](information-security-policy.md)
- [Operations Runbook](operations-runbook.md)
- [User Guide](user-guide.md)

## 12. Policy Review

This policy is reviewed and updated at least annually, or when significant changes occur to the identity management infrastructure, user base, or regulatory requirements.

---

*This document supplements the Organization's Written Information Security Program (WISP) and provides detailed identity and access management procedures for the financial management system.*
