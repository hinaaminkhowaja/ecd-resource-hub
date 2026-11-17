# ECD Resource Hub

A React dashboard for ECD resource records and staged delivery receipts.

## Run in GitHub Codespaces

After pulling updates, run `npm install`, then `npm run dev`. The command starts the dashboard and the private receipt service together. Vite forwards the dashboard on port 5173.

## Enable email notifications

1. Copy `.env.example` to `.env`.
2. Enter SMTP settings for the sender account. The app can use Outlook, Gmail, or another email service that provides SMTP access.
3. Keep `.env` private. It is ignored by Git and must never be committed.
4. Restart `npm run dev`.

The receipt service emails both listed contacts when each handoff is completed. It checks deadlines every five minutes and emails both contacts when the next handoff is due and still pending. Reminder times use the configured `TIME_ZONE` (default `Asia/Karachi`).

Receipt data is saved to an ignored file in the Codespace. Automatic email and reminders run only while the Codespace is running. For reminders that continue while the Codespace is stopped, deploy the receipt service and its storage to an always-on host.

## Receipt stages

1. Head Office dispatch to a region
2. Region receipt
3. Region dispatch to an REC
4. REC receipt

Each stage records sender and receiver email addresses, a due date for the next handoff when applicable, and a completion time. Resource types include Curriculum, Activity Books, Plans, Furniture, and Resource Kits.

