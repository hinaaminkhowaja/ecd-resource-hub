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


## Cloudflare deployment

The production app is served by a Cloudflare Worker. The Worker handles the API and serves the Vite build from the static assets binding. D1 stores regional users, sessions, delivery receipts, and red-flag reasons.

1. In Codespaces, pull the latest `main` and run `npm install`.
2. Authenticate Wrangler with `npx wrangler login`.
3. Create the database: `npx wrangler d1 create ecd-resource-hub-db`.
4. Copy the returned database ID into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.
5. Set the first-admin bootstrap email as a Worker secret: `npx wrangler secret put ADMIN_EMAIL`. Enter the admin email when prompted. This is only used if no administrator has been imported.
6. Create the D1 tables: `npx wrangler d1 migrations apply ecd-resource-hub-db --remote`.
7. Import existing local data (if the Codespace has the ignored `data/users.json`, `data/receipt-store.json`, and `data/red-flag-reasons.json` files): `npm run cf:import`.
8. Deploy: `npm run cf:deploy`.

After deployment, Wrangler prints the public `workers.dev` URL. Test administrator sign-in, regional account restrictions, receipts, and red-flag reason saving before sharing the URL.

**Data migration warning:** The old JSON data files are ignored by Git and are not copied to Cloudflare automatically. Run the import command from the Codespace that contains the current data files. Do not delete the local data folder until the Cloudflare deployment has been verified.

**Authentication note:** The current app accepts an assigned email address without verifying ownership. Anyone who knows an active account email could sign in as that user. Use the link only with the intended limited team until verified email or OTP authentication is added.
