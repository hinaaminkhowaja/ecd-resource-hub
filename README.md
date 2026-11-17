# ECD Resource Hub

A React dashboard for ECD resource records and staged delivery receipts.

## Run in GitHub Codespaces

After pulling updates, run `npm install`, then `npm run dev`. The command starts the dashboard and receipt service together. Vite forwards the dashboard on port 5173.

## Calendar reminders

In the dashboard delivery timeline, select **Add to calendar** for an upcoming deadline. The app downloads an `.ics` event with reminders one day and 15 minutes before the deadline. Open or import the file with Outlook or another calendar app to receive its phone notifications. If a deadline changes, add the updated event again and remove the old one from the calendar.

Calendar reminders use the calendar app on the device. The project does not send email or require Power Automate premium features.

Receipt data is saved to an ignored file in the Codespace. Resource types include Curriculum, Activity Books, Plans, Furniture, and Resource Kits.

## Receipt stages

1. Head Office dispatch to a region
2. Region receipt
3. Region dispatch to an REC
4. REC receipt
