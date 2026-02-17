# Information Security Policy

**Renewal Initiatives, Inc.**
A Massachusetts 501(c)(3) Nonprofit Corporation

**Effective Date:** February 17, 2026
**Last Reviewed:** February 17, 2026
**Next Review Date:** February 17, 2027
**Approved By:** Board of Directors
**Policy Owner:** Jeff Takle, Board Member & System Administrator

---

## 1. Purpose

This policy establishes the information security program for Renewal Initiatives, Inc. ("the Organization"). It defines the administrative, technical, and physical safeguards used to protect personal information, financial data, and organizational assets in compliance with Massachusetts data security regulations (201 CMR 17.00) and nonprofit financial management best practices.

## 2. Scope

This policy applies to:

- All staff, board members, contractors, and volunteers who access organizational information systems
- All systems that store, process, or transmit personal information of Massachusetts residents, donor data, employee data, or financial records
- All third-party service providers with access to organizational data

## 3. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Board of Directors | Approve security policy; ensure adequate resources for information security |
| System Administrator | Implement and maintain security controls; manage user access; respond to incidents |
| Staff Users | Follow security procedures; report suspected incidents; complete security awareness training |

Given the Organization's size (2–5 staff), the System Administrator also serves as the designated security coordinator required under 201 CMR 17.03.

## 4. Risk Assessment

The Organization conducts an annual risk assessment to identify threats to personal information and financial data. The assessment evaluates:

- Internal risks (employee access, device security, data handling procedures)
- External risks (unauthorized access, cyberattacks, third-party vendor risks)
- System risks (application vulnerabilities, infrastructure configuration)

Findings are documented and used to prioritize security improvements. The most recent assessment identified the following key risk areas and corresponding controls:

| Risk Area | Mitigation |
|-----------|-----------|
| Unauthorized system access | OIDC authentication with RBAC via Zitadel; PKCE flow; role-based access control |
| Third-party API credential exposure | AES-256-GCM encryption at rest for Plaid tokens; environment variable isolation |
| Employee PII exposure | Cross-database encryption of tax IDs; least-privilege read-only access to HR data |
| Financial data integrity | Append-only audit log with transactional guarantees; double-entry GL engine |
| Bank account data breach | Encrypted access tokens; no storage of account/routing numbers; read-only Plaid integration |

## 5. Access Controls

### 5.1 Authentication

- All users authenticate via OpenID Connect (OIDC) through Zitadel, a dedicated identity provider
- Authentication uses PKCE (Proof Key for Code Exchange) — no client secrets are stored in the application
- Sessions are managed via signed JWTs with automatic expiration
- All authentication endpoints are served over TLS 1.2+

### 5.2 Authorization

- Role-based access control (RBAC) with two tiers: `user` and `admin`
- Access is granted only to users with explicit project role assignments (`admin` or `app:finance`) in Zitadel
- Users without valid role assignments are denied access at sign-in
- Admin functions (account configuration, manual data syncs, user management) are restricted to admin-role users

### 5.3 Multi-Factor Authentication

- MFA is configured through the Zitadel identity provider and enforced for all user accounts
- Supported second factors include TOTP authenticator apps and WebAuthn/FIDO2 security keys

### 5.4 Access Reviews

- User access is reviewed quarterly by the System Administrator
- Departing staff accounts are deactivated in Zitadel immediately upon separation
- Service account keys are rotated annually or upon personnel changes

## 6. Data Protection

### 6.1 Data Classification

| Classification | Examples | Handling Requirements |
|---------------|----------|----------------------|
| **Confidential** | Employee SSNs/tax IDs, bank access tokens, API secrets | Encrypted at rest and in transit; access restricted to admin role; never logged |
| **Sensitive** | Donor PII, financial transactions, payroll data, bank account numbers | Encrypted in transit; access restricted to authorized users; audit-logged |
| **Internal** | Chart of accounts, budget data, reports, organizational policies | Access restricted to authenticated users |
| **Public** | Organization name, EIN, published 990 data | No special handling required |

### 6.2 Encryption

- **In transit:** All data transmitted over HTTPS/TLS 1.2+ enforced by Vercel's edge network. Database connections use SSL (`sslmode=require`).
- **At rest:** Plaid access tokens are encrypted using AES-256-GCM before database storage. Employee tax identifiers are encrypted using AES-256-GCM in the source HR system and decrypted only during payroll processing. Database storage is encrypted at rest by the provider (Neon PostgreSQL).
- **Secrets management:** API keys and credentials are stored as environment variables in Vercel's encrypted secrets store, never committed to source code.

### 6.3 Data Retention

- Financial records: Retained for 7 years per IRS requirements for 501(c)(3) organizations
- Audit logs: Retained indefinitely (append-only, never deleted)
- Bank transaction data: Retained for duration of account connection plus 7 years
- Employee PII: Retained only for duration of employment plus applicable tax filing periods
- Plaid access tokens: Revoked and deleted when bank account connections are removed

### 6.4 Data Deletion

When retention periods expire, data is deleted according to the following procedures:

- **Financial records and bank transactions:** Deleted from the database after the 7-year retention period. Deletion is logged in the audit log for compliance verification.
- **Employee PII:** Deleted within 90 days of the end of the applicable retention period (employment termination plus final tax filing cycle). Encrypted tax identifiers are purged from all systems.
- **Plaid access tokens:** Revoked via the Plaid API and deleted from the database immediately when a bank account connection is removed.
- **User accounts:** Deactivated in Zitadel upon separation; deleted after 1 year if no reactivation is needed.

The System Administrator reviews data retention compliance during the annual policy review and initiates any required deletions.

### 6.5 Data Minimization

- The Plaid integration operates in read-only mode (Transactions product only) — no account numbers, routing numbers, or payment capabilities are enabled
- Employee tax IDs are accessed via cross-database read-only connection and only used during payroll processing
- No credit card numbers are stored; Ramp integration uses OAuth tokens only

## 7. System Security

### 7.1 Application Architecture

- **Hosting:** Vercel (SOC 2 Type II compliant) with automatic SSL, DDoS protection, and edge network
- **Database:** Neon PostgreSQL (SOC 2 Type II compliant) with connection pooling, SSL enforcement, and automated backups
- **Identity Provider:** Zitadel Cloud (SOC 2 Type II, ISO 27001 compliant) for authentication and user management
- **Source Code:** Private GitHub repository with branch protection rules

### 7.2 Application Security Controls

- Server-side input validation using Zod schemas on all data entry points
- SQL injection prevention via parameterized queries (Drizzle ORM)
- CSRF protection via NextAuth.js signed tokens
- XSS prevention via React's default output encoding and Content Security Policy headers
- Middleware-enforced authentication on all routes except public authentication endpoints
- Cron job endpoints protected by secret-based authentication

### 7.3 Audit Logging

- All financial transactions, account modifications, and administrative actions are recorded in an append-only audit log
- Audit log entries include: user ID, action, entity type, entity ID, before/after state, and timestamp
- Audit writes are transactional — if the audit log insert fails, the entire operation rolls back, ensuring no unaudited changes occur

### 7.4 Dependency Management

- Application dependencies are tracked in `package-lock.json` and reviewed during updates
- GitHub Dependabot alerts are monitored for known vulnerabilities in dependencies
- Dependencies are updated regularly with preference for security patches

## 8. Third-Party Vendor Management

All third-party vendors with access to organizational data are evaluated for security practices. Current vendors:

| Vendor | Data Accessed | Security Certifications | Review Frequency |
|--------|--------------|------------------------|-----------------|
| Vercel | Application code, environment variables | SOC 2 Type II | Annual |
| Neon | All database contents | SOC 2 Type II | Annual |
| Zitadel | User identities, authentication data | SOC 2 Type II, ISO 27001 | Annual |
| Plaid | Bank account link tokens (read-only) | SOC 2 Type II, ISO 27001 | Annual |
| Ramp | Corporate card transaction data (OAuth) | SOC 2 Type II | Annual |
| Postmark | Donor email addresses (transactional email) | SOC 2 Type II | Annual |
| GitHub | Source code | SOC 2 Type II, ISO 27001 | Annual |

## 9. Physical Security

- No organizational data is stored on local devices or physical media
- All data resides in cloud-hosted, SOC 2–compliant infrastructure
- Staff devices used to access the system must use full-disk encryption (FileVault on macOS, BitLocker on Windows)
- Staff devices must use a screen lock with a maximum 5-minute idle timeout

## 10. Incident Response

### 10.1 Incident Classification

| Severity | Description | Response Time |
|----------|-------------|--------------|
| **Critical** | Confirmed data breach involving personal information or financial data | Immediate (within 1 hour) |
| **High** | Unauthorized access attempt, compromised credentials, system outage | Within 4 hours |
| **Medium** | Failed login anomalies, suspicious activity, minor vulnerability discovered | Within 24 hours |
| **Low** | Policy violation, configuration issue, informational alert | Within 72 hours |

### 10.2 Response Procedures

1. **Detect:** Monitor Vercel deployment logs, database access logs, Zitadel audit events, and application audit logs for anomalies
2. **Contain:** Deactivate compromised accounts in Zitadel; rotate affected API keys/secrets; revoke Plaid access tokens if bank data is at risk
3. **Investigate:** Review audit logs, application logs, and third-party provider logs to determine scope and root cause
4. **Remediate:** Patch vulnerabilities, update access controls, and restore from backups if needed
5. **Notify:** Per Massachusetts law (M.G.L. c. 93H), notify affected individuals and the Attorney General's office of any breach of personal information without unreasonable delay
6. **Document:** Record incident details, timeline, root cause, and corrective actions taken

### 10.3 Contact Information

- **System Administrator:** Jeff Takle — jtakle@renewalinitiatives.org
- **Massachusetts Attorney General (breach notification):** (617) 727-8400
- **Plaid security team:** security@plaid.com

## 11. Business Continuity

- **Database backups:** Neon PostgreSQL provides continuous automated backups with point-in-time recovery
- **Application recovery:** Application is deployed via Git; any prior version can be redeployed from version control within minutes
- **Access recovery:** Zitadel Cloud maintains independent availability; if the application is down, user accounts and credentials remain intact
- **Key rotation:** If encryption keys are compromised, Plaid tokens can be re-encrypted with new keys; Plaid access tokens can be revoked and re-established through Plaid Link

## 12. Security Awareness

- All staff receive a security orientation upon onboarding that covers this policy, acceptable use, phishing awareness, and incident reporting
- The System Administrator communicates relevant security updates and emerging threats to staff as needed
- This policy is made available to all staff and reviewed during annual policy review

## 13. Massachusetts 201 CMR 17.00 Compliance

This policy satisfies the Written Information Security Program (WISP) requirement under 201 CMR 17.00 for the protection of personal information of Massachusetts residents. Specifically:

- **17.03(1):** Designated security coordinator — the System Administrator
- **17.03(2)(a):** Identified internal and external risks — Section 4
- **17.03(2)(b):** Access controls — Section 5
- **17.03(2)(c):** Disciplinary measures for violations — handled through existing employee policies
- **17.03(2)(d):** Terminated employee access — Section 5.4
- **17.03(2)(e):** Third-party vendor oversight — Section 8
- **17.03(2)(f):** Physical security — Section 9
- **17.03(2)(g):** Annual review — this policy is reviewed annually
- **17.04:** Technical security measures — encryption, authentication, access controls, audit logging per Sections 5–7

## 14. Policy Review

This policy is reviewed and updated at least annually, or more frequently if:

- A security incident occurs
- Significant changes are made to information systems or data processing activities
- Changes in applicable laws or regulations require updates

---

*This document constitutes the Written Information Security Program (WISP) for Renewal Initiatives, Inc. as required by 201 CMR 17.00.*
