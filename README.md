Gaza Timemap Backend
This is the back end for the Gaza Timemap. It runs behind the scenes to collect data from different websites, clean it up, and send it to the map. The premise is that it must be secure, easy to access and automated

Features
1. Self Updating Data
Aan automatic timer (cron job) runs every 6 hours to fetch from the sources:  TechForPalestine and ReliefWeb and saves everything to a local Excel file named gaza_timemap.xlsx. Eeven ifthe source is not available, thre is the last saved copy.

2. Admin Dashboard
There is a control panel to view events and statistics without the need of checking what is happening on the terminal or the code, and a button to force data update immediately. You can access it at http://localhost:4040/api/dashboard.

3. Security Basics
Limited requests to 100 every 15 minutes, to prevent bots and DDOS. There is also password protection to prevent and differentiate the user from the admin.

How the Data Looks
The data is normalized to a single format and enforced by a contract. It must have a date (YYYY-MM-DD), a location name, coordinates (latitude and longitude), and a source name. If a source doesn't provide a specific location or date, we just leave that field blank, but the structure stays the same so that Timemap does not break.

Architecture
A simple Excel file, which is the standard way for Timemap projects, every row representing a single record.

Flow

Fetch: Grabs the data from the external API.

Clean: Process the data so that each record looks the same.

Save: OVerwrite EXPORT_EVENTS tab within the XLSX file.

Serve: The frontend checks against the validator.js class and presents the data.

API Endpoints
Public Links
GET /api/external/events gives all events presented by date. It can be filtered with paramaters, examples:  ?from=2023-10-01r ?source=ReliefWeb.

GET /api/external/analytics/events, for simple stats, as event sources, total counts or records missing fields. 

GET /api/external/health checks if the sources are down or available.

Admin Links
Password protected. Use GET /api/external/sync-xlsx forces the server to retrieve data despite the cronjob. There is also GET /api/update to refresh server memory.

What's Connected?
TechforPalestine and ReliefWeb

Setup
You will need the .env files which are included in the final report. You can download the zipped file and run npm run dev for both server and timemap. You will need node.js and npm installed on the machine, plus babel, node-cron and express-rate-limit.

What's missing?
- A logic that compares the data within the data sources. But the data retrieved is very different for each sources, as they are summaries, daily totals and reports respectively. So this could be a challenge.
- Deploy to production, due to time constraints, as in today this has not been possible. 