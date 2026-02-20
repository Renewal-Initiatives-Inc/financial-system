# Pre-Flight Checklist — Heather Walkthrough

**Purpose:** Structured walkthrough sessions with Heather before go-live. Six sessions, ~30 minutes each. Covers decisions, training, and configuration that requires her input.

**Status:** Draft v2 — rewritten with presentation framing

**General rules for all sessions:**
- Lead with the workflow and the "why," not the screen
- Don't show UI until she understands the job it's doing
- Separate "what information do you need" from "how should it look" — tell her explicitly that both matter, but they're different conversations
- Give her a role and decision authority, not a critique session
- Hard 30-minute cap. If it's not done, schedule a follow-up. Don't let it sprawl.

---

## Session 1 — "Where Does the Money Go?"

**Time:** ~30 minutes
**Covers:** GL Account Review (#1), including fund mapping
**Prerequisite:** Resolve the AHP Fund question with the board first (see note below)

### What to say up front

"Every time money comes in or goes out, the system needs to know which bucket to put it in. I've set up the buckets based on what I know about how RI works, but you're the one who does this every day, so I need you to tell me if these match how you actually think about the money. I'm not going to show you a big list of accounts — instead, I'm going to walk you through a few things you do regularly and you tell me if anything feels wrong."

### What NOT to say

Don't say "chart of accounts." Don't say "general ledger." Don't open the Chart of Accounts page and say "let me show you this." Start with the work, not the tool.

### How to run it

Walk through 3-4 of the scenarios below. For each one, narrate what happens in the system — which accounts get hit, which fund it lands in — and ask: *"Does that match how you'd think about it?"*

### Pick 3-4 of these real-world examples

1. **A donor mails a $500 check for general support.** Deposit it, record it. → General Fund, Donation Revenue. Does "Donation Revenue" match what she'd call it?

2. **MassDev sends a quarterly grant disbursement.** Wire hits checking. → MassDev Fund, Grant Revenue. Does she think of grant money as "revenue" or something else?

3. **Heather buys printer paper on the Ramp card.** $47 at Staples. → General Fund, Office Supplies, classified as Admin. Does she agree it's Admin and not Program?

4. **Tenant pays January rent for a CPA unit.** Check deposited. → CPA Fund, Rental Income. Is "Rental Income" the right label? Does she associate rent with the CPA fund?

5. **Eversource bill arrives for a property.** $280. → Utilities Expense, allocated to the property's fund. Does she track utilities by property? By fund? Both?

6. **Payroll runs for an employee splitting 60% Program / 40% Admin.** → System splits salary expense across functional categories. Does she do this split today? Does the ratio feel right?

7. **A contractor invoices $2,000 for property repair work.** Heather cuts a check. → Maintenance & Repairs expense under the relevant fund. Does she call it "Maintenance & Repairs" or something else?

8. **Someone donates furniture for a rental unit.** No cash changes hands. → In-Kind Donation at fair market value. Does she track in-kind today? Does she need guidance in the flow for estimating value?

9. **Annual insurance renewal — $3,600 paid upfront.** → Prepaid Expense that amortizes monthly. Does she think of this as one big January expense or a little one each month? (Good accrual teaching moment.)

10. **Jeff transfers $5,000 from savings to checking to cover payroll.** → Internal transfer — no revenue, no expense. Does she record transfers in QBO today, or let the bank statements sort it out?

### What to ask at the end

"Were there any moments where the name I used didn't match the word in your head? And is there anything you do regularly that I didn't mention — any type of transaction I missed?"

### Then — and only then — show the fund list

"These funds are the big buckets the system uses to keep the money separate: General, CPA, MassDev, HTC Equity, MassSave. Are these the right buckets? Is anything missing? Is anything here that shouldn't be?"

### Decisions to capture

- [ ] Are there accounts missing that she needs for her workflows?
- [ ] Are there accounts she thinks are unnecessary or confusing?
- [ ] Does the account numbering scheme make sense to her?
- [ ] Does she want hide/show or activate/deactivate on accounts in the UI?
- [ ] Does she use QBO "Classes" consistently? Are there transactions with no class, or class names that don't match our fund names?
- [ ] Any funds missing or funds that should be consolidated?

### ⚠️ Pre-session prerequisite: AHP Fund resolution

The AHP loan agreement (executed 2025-10-29) specifies proceeds are for "general charitable and operational purposes" with no restrictions on spending. This means:
- Loan proceeds are **not restricted funds** under GAAP (ASC 958)
- The loan is a **liability** (note payable), not net assets in a restricted fund
- If/when AHP forgives portions of the loan, the forgiven amount becomes contribution revenue classified as **without donor restrictions** (no conditions on spending tied to forgiveness)
- The only accounting basis for a separate "AHP Fund" would be a **board designation** — a voluntary internal tracking choice, not a GAAP requirement

**Resolve before Session 1:** Confirm with the board whether they want a board-designated tracking bucket for AHP-related activity or whether it belongs in General Fund. Either answer is valid, but presenting it as a restricted fund alongside CPA/MassDev is misleading. If this isn't resolved, the fund discussion in Session 1 will get derailed.

---

## Session 2 — "Cleaning the House Before We Move"

**Time:** ~30 minutes
**Covers:** QBO Reconciliation (#2) + Cutoff Date (#3)

### What to say up front

"Before we can move anything into the new system, QBO needs to be buttoned up through a specific date. Think of it like closing out the register before handing the cash drawer to the next person. I need to know where you stand on reconciliation, and then we'll pick the handoff date together."

### What to show

Nothing in the new system. This session is about QBO. If possible, have QBO open and look at reconciliation status together.

### What NOT to do

Don't show her the import tool. Don't explain the technical migration process. She doesn't need to know how the sausage gets made. She needs to know the house is clean and when the moving truck arrives.

### Reconciliation — what to ask

- "Are you current on bank rec in QBO, or are you behind? No judgment — I just need to know the timeline."
- "Checking, savings, Ramp — are those the only accounts, or is there anything else? PayPal? Petty cash?"
- "Any transactions in QBO you know are wrong — duplicates, miscategorized, things you've been meaning to fix?"

### Cutoff Date — what to ask

- "Once we pick the date, everything before it stays in QBO, everything after goes in the new system. Are you comfortable going cold turkey, or do you want a few days of overlap where you enter in both?"
- "What does your schedule look like for a couple days to review the imported data? You'll need to eyeball it and confirm it looks right."
- "Is there anything in-flight right now — approved but not posted — that we need to decide which side of the line it goes on?"
- "After cutoff, who stops entering in QBO? Just you, or does anyone else have QBO access?"

### Decisions to capture

- [ ] Reconcile UMass Five checking in QBO through the cutoff date
- [ ] Reconcile UMass Five savings in QBO through the cutoff date
- [ ] Reconcile Ramp credit card in QBO through the cutoff date
- [ ] Confirm no uncleared/pending items that should have been recorded
- [ ] Any other accounts in QBO besides checking, savings, and Ramp?
- [ ] Any known "problem" transactions that need fixing before import?
- [ ] Is she current on reconciliation or behind? (Affects timeline)
- [ ] Cutoff date selected (likely mid-February 2026, aligned with a reconciliation cycle)
- [ ] Cold turkey or overlap period?
- [ ] Availability for import + verification window
- [ ] Any in-flight transactions that need a ruling

---

## Session 3 — "The Big Translation"

**Time:** ~30 minutes (could run longer — build in buffer)
**Covers:** Cash-to-Accrual Conversion (#4)
**Format:** Working session — Jeff, Heather, and Claude at the table together

### What to say up front

"QBO tracked everything on a cash basis — money in, money out, done. The new system uses accrual accounting, which means we also track money you're owed but haven't received, and bills you owe but haven't paid yet. We're going to go through these one at a time. Claude will propose each adjustment and explain why. You and I approve or tweak each one. It's a one-time thing."

### What to show

The adjustment proposals as they come up. Each one with a plain-English explanation.

### What NOT to do

Don't use the words "debit" or "credit" if you can avoid it. "We're going to record that RI owes this bill" is better than "we're going to debit accounts payable."

### Prep work for Heather (give her this a day or two before)

"Before we sit down, think about whether any of these apply at the cutoff date:
- Bills you've received but haven't paid yet
- Money RI has earned but hasn't collected yet
- Things you paid for in advance (insurance, subscriptions)
- Cash received for work you haven't done yet
- Employee wages earned but not yet paid"

### How it works

- Claude proposes each adjustment with an explanation of why it's needed
- Heather and Jeff approve or modify each one before it posts
- This is a one-time conversion, not an ongoing process

---

## Session 4 — "What's Due and What's Done"

**Time:** ~30 minutes total (~15 compliance, ~15 reports)
**Covers:** Compliance Calendar (#6) + Reports (#7)

### Compliance Calendar (~15 min)

**What to say:**
"The system already has your deadlines loaded — 990 filing, AG Form PC, all of it. I want you to look at this and tell me if anything's missing or if any dates are wrong."

**What to show:**
The live compliance calendar with her real deadlines. This is your quickest confidence-builder — she'll see her own world reflected back at her.

**What to ask:**
- "Is anything missing? Deadlines you track that aren't here?"
- "Are the reminder lead times right, or do you need more heads-up on certain items?"
- "Do you want to be able to attach documents — like the filed 990 PDF — to a completed deadline?"
- "Is 'pending / in-progress / complete' enough, or do you need more status options?"

### Reports (~15 min)

**What to say:**
"Let me show you what the board pack looks like coming out of this system. Tell me if this is what the board expects to see."

**What to show:**
A rendered board pack or specific report output. Not the reports *page* — the report *itself*. If you can generate one with real (or realistic) data, even better.

**What NOT to do:**
Don't walk her through the reports index page. Don't say "we have 25 report types." Show her a specific output and ask if it's right.

**What to ask:**
- "Does this match what you give the board today?"
- "Is there a report you pull from QBO regularly that you don't see here?"
- "PDF, Excel, or both for exports?"
- "Are the filtering and date range options flexible enough?"

### Decisions to capture

- [ ] Any compliance deadlines missing or dates wrong?
- [ ] Document attachment on completed deadlines — yes/no?
- [ ] Additional status states needed beyond pending/in-progress/complete?
- [ ] Reminder lead times correct?
- [ ] Board pack format matches board expectations?
- [ ] Missing report equivalents from QBO?
- [ ] Export format preferences
- [ ] Charting preferences — which visualizations would be useful?

---

## Session 5 — "The Budget Conversation"

**Time:** ~30 minutes
**Covers:** Budget Design (#9)

### What to say up front

"Budgeting is one of those things where everyone has a different mental model. Before I show you what I've built, I want to understand how you think about budgets. Walk me through how you build one today."

### What NOT to do

Do NOT open the budget module first. Start with her process. Let her describe it. Then — and only then — show the system and see where it matches and where it doesn't.

If her model is fundamentally different from what's built, don't defend the current design in the moment. Just say "got it, that's really useful — let me think about how to adjust this."

### What to ask (before showing anything)

- "When you sit down to build a budget, what's your starting point? Last year's actuals? A blank sheet? Board guidance?"
- "Do you think about one big org-wide budget, or do you build separate budgets for each fund?"
- "When something changes mid-year — say a new grant comes in — how do you handle the budget? Do you revise it formally, or just mentally adjust?"
- "What does 'over budget' mean to you? Is there a threshold where you'd want the system to flag it?"
- "Who owns the budget process? You draft, Jeff approves, board ratifies? Or different?"

### Then show the module

Walk through it together. Be prepared: this is the most likely session to surface a mismatch between what's built and what she expects.

### Decisions to capture

- [ ] Budget granularity — account level, category level, or line-item level?
- [ ] Fund-level vs consolidated budgets — one, the other, or both?
- [ ] Budget periods — annual only, or monthly/quarterly breakdowns?
- [ ] Revision workflow — how does she handle mid-year changes?
- [ ] Variance thresholds — what triggers an alert?
- [ ] Multi-year comparison needed? (FY25 actual vs FY26 budget vs FY27 projection)
- [ ] Any budget categories that don't map to current GL accounts?

**⚠️ Warning:** This could require significant rework if her model differs from ours. Schedule enough time and be prepared to iterate.

---

## Session 6 — "Living In It"

**Time:** ~30 minutes
**Covers:** Navigation (#5) + Payment Initiation (#8)
**Why this is last:** By now she's actually used the system for real tasks. Her opinions about navigation will be grounded in experience, not first impressions.

### Navigation (~15 min)

**What to say:**
"You've been in the system for a bit now. What do you find yourself clicking on every day? What do you have to hunt for? If you could rearrange the sidebar like a bookshelf, what goes at eye level?"

**What to ask:**
- "What three things do you use most?"
- "Is there anything you've never clicked on?"
- "Anything feel buried that should be more obvious?"
- "Do you want the sidebar collapsed or expanded by default?"

**What NOT to do:**
Don't show her the nav and ask "does this make sense?" cold. That's what triggers the "change that icon" reflex. Ground it in her actual usage first.

### Payment Initiation (~15 min)

**What to say:**
"This one's forward-looking. Right now you record payments here but actually make them elsewhere — bank, Ramp, whatever. I'm exploring whether we could do it all from one place. Before I go down that road, tell me about your current pain points."

**What to ask:**
- "How do you pay bills today? Walk me through it."
- "What's annoying about it?"
- "How many payments per month, roughly?"
- "If you could pay a bill right from this system — hit approve, money goes — would that be useful, or does that make you nervous?"
- "Is check printing still needed, or can everything go electronic?"
- "Do any vendors require specific payment methods?"
- "Does Jeff need to approve payments over a certain amount?"

**What NOT to do:**
Don't present the four technical options (Plaid Transfer, Bill.com, Ramp bill pay, direct ACH). She doesn't care about the plumbing. Get the requirements from her, then Jeff and Claude figure out the implementation.

### Decisions to capture

- [ ] Nav items to promote (daily use)
- [ ] Nav items to demote (rarely used)
- [ ] Icon/label changes requested
- [ ] Sidebar default state preference
- [ ] Current bill payment workflow and pain points
- [ ] Volume of payments per month
- [ ] Check printing still needed?
- [ ] Approval workflow requirements
- [ ] Vendor-specific payment method requirements

---

## Technical Notes (Jeff only — not for Heather sessions)

### Payment Initiation — Options to Research Before Session 6

- **Plaid Transfer** — ACH payments via Plaid's existing connection to UMass Five. Lower cost, but limited to ACH (no checks, no international).
- **Bill.com integration** — Full AP automation (approval workflows, payment scheduling, vendor portal). More capable but adds a subscription and a new integration.
- **Ramp bill pay** — Ramp already offers bill pay for Ramp cardholders. May be the simplest path if it covers the use cases.
- **Direct ACH via UMass Five** — Some banks offer ACH origination APIs. Worth checking if UMass Five supports this.

Jeff should do initial research on feasibility and cost before Session 6. Heather shapes the "what we need" — Jeff and Claude solve the "how."
