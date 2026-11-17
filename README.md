# ECD Resource Hub

A React dashboard for ECD resource records and staged delivery receipts.

## Run in GitHub Codespaces

After pulling updates, run `npm install`, then `npm run dev`. The command starts the dashboard and the private receipt service together. Vite forwards the dashboard on port 5173.

## Send notifications with Power Automate

1. In Power Automate, create an **Automated cloud flow** with the **When an HTTP request is received** trigger.
2. Use this JSON schema for the trigger:

   ```json
   {
     "type": "object",
     "properties": {
       "source": { "type": "string" },
       "recipients": { "type": "array", "items": { "type": "string" } },
       "subject": { "type": "string" },
       "message": { "type": "string" },
       "sentAt": { "type": "string" }
     },
     "required": ["recipients", "subject", "message"]
   }
   ```

3. Add **Office 365 Outlook – Send an email (V2)**. Set **To** to the expression `join(triggerBody()?['recipients'], ';')`, **Subject** to `subject`, and **Body** to `message` from the trigger. Save the flow and copy its HTTP POST URL.
4. Put that URL in `.env` as `POWER_AUTOMATE_URL=...`. Treat the URL as a secret; keep `.env` private and never commit it. This setting takes priority over SMTP.
5. Restart `npm run dev`.

Each completed stage and overdue reminder is posted to the flow with the recipients selected for that stage. Power Automate sends through its connected Outlook account. The optional `POWER_AUTOMATE_KEY` can be checked in a flow condition against the `x-ecd-notification-key` request header.

Reminder checks run every five minutes while the receipt service is running. Since the service currently runs in the Codespace, automatic reminder checks pause when the Codespace is stopped.

## Receipt stages

1. Head Office dispatch to a region
2. Region receipt
3. Region dispatch to an REC
4. REC receipt

Each stage records sender and receiver email addresses, a due date for the next handoff when applicable, and a completion time. Resource types include Curriculum, Activity Books, Plans, Furniture, and Resource Kits.

