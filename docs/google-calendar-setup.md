# Google Calendar Integration Setup

## Prerequisites

Before any code can run, complete these manual setup steps in order.

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **New Project**
3. Set **Project name**: `renewal-initiatives-financial-system`
4. Click **Create**

---

## Step 2: Enable Google Calendar API

1. In your new project, go to **APIs & Services → Library**
2. Search for **Google Calendar API**
3. Click **Enable**

---

## Step 3: Create Service Account

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → Service Account**
3. Set **Service account name**: `compliance-calendar-sync`
4. Set **Service account ID**: `compliance-calendar-sync` (auto-filled)
5. Click **Create and Continue**
6. Skip optional steps, click **Done**
7. The full service account email will be:
   ```
   compliance-calendar-sync@renewal-initiatives-financial-system.iam.gserviceaccount.com
   ```

---

## Step 4: Download Service Account Key

1. Click the service account you just created
2. Go to **Keys → Add Key → Create new key**
3. Select **JSON**, click **Create**
4. Save the downloaded file as `service-account-key.json` (do not commit this file)

---

## Step 5: Create the Compliance Calendar

1. Log in to Google Calendar with the Renewal Initiatives Google Workspace admin account
2. In the left panel under **Other calendars**, click **+**
3. Select **Create new calendar**
4. Set **Name**: `renewal-initiatives-compliance`
5. Click **Create calendar**

---

## Step 6: Share Calendar with Service Account

1. In Google Calendar, click the three-dot menu next to the new calendar
2. Select **Settings and sharing**
3. Under **Share with specific people or groups**, click **Add people and groups**
4. Enter the service account email:
   ```
   compliance-calendar-sync@renewal-initiatives-financial-system.iam.gserviceaccount.com
   ```
5. Set permission to **Make changes to events**
6. Click **Send**

---

## Step 7: Copy Calendar ID

1. In the calendar's **Settings and sharing** page, scroll down to **Integrate calendar**
2. Copy the **Calendar ID** (looks like `abc123@group.calendar.google.com`)

---

## Step 8: Add Environment Variables to Vercel

Run the following commands to set environment variables for all environments. Use `printf` (not `echo`) to avoid trailing newline issues:

```bash
# Add Google service account key (base64-encoded JSON)
printf '%s' "$(cat service-account-key.json | base64)" | vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production
printf '%s' "$(cat service-account-key.json | base64)" | vercel env add GOOGLE_SERVICE_ACCOUNT_KEY preview
printf '%s' "$(cat service-account-key.json | base64)" | vercel env add GOOGLE_SERVICE_ACCOUNT_KEY development

# Add Calendar ID
printf '%s' 'your-calendar-id@group.calendar.google.com' | vercel env add GOOGLE_CALENDAR_ID production
printf '%s' 'your-calendar-id@group.calendar.google.com' | vercel env add GOOGLE_CALENDAR_ID preview
printf '%s' 'your-calendar-id@group.calendar.google.com' | vercel env add GOOGLE_CALENDAR_ID development
```

After adding, pull the updated env vars to your local `.env.local`:

```bash
vercel env pull .env.local
```

---

## How Sync Works

The sync engine runs daily as part of the existing compliance-reminders cron (`0 6 * * *`). It:

1. Reads all non-completed compliance deadlines from the DB
2. Creates Google Calendar events for any deadline missing a `googleEventId`
3. Updates existing events to reflect any changes (name, date, description)
4. Deletes any Google Calendar events that no longer have a matching deadline in DB
5. Stores the returned `googleEventId` back on each deadline row

The financial system is authoritative — changes made directly in Google Calendar are not synced back. The daily sync will overwrite them on the next run.

---

## Verification

After completing setup and deploying, verify connectivity by triggering the cron manually:

```bash
curl -X GET https://finance.renewalinitiatives.org/api/cron/compliance-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

The response will include a `calendarSync` field showing how many events were created/updated/deleted.
