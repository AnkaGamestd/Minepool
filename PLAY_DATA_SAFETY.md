# Google Play Data safety draft

This is a repository-based draft for the Play Console form. Recheck every production SDK, hosting provider, log destination, and analytics service before submission.

## Data handled by the current app

| Play data category | Examples in Mine Pool | Purpose | Required? |
| --- | --- | --- | --- |
| Personal info: name | Player name; optional Google profile name | Account management and multiplayer identity | Required for online account; not for guest play |
| Personal info: email | Email login; Google account email | Authentication, account recovery/support | Required for online account; not for guest play |
| User IDs | Internal account ID; Google subject ID | Authentication and account linking | Required for the selected sign-in method |
| App activity | Match results, rating, tournament and game progress | Core game functionality and matchmaking | Yes for online play |
| App info/performance | Limited server, crash and diagnostic logs | Reliability, fraud prevention and security | Confirm against production hosting configuration |
| Device or other IDs | IP address in server/security logs | Security, abuse prevention and networking | Confirm against production hosting configuration |

## Current declarations

- Data is encrypted in transit with HTTPS/WSS in production.
- Passwords are stored as one-way bcrypt hashes; raw passwords are not retained.
- Personal data is not sold.
- The app currently has no advertising SDK and no real-money, cryptocurrency, or wallet integration.
- Users can play locally as a guest, delete an authenticated account in the app, or request deletion at `/delete-account.html`.
- Deleting an account removes its active profile, avatar and game records. Limited security logs or backups may remain for the period stated in the privacy policy.

## Before publishing

- Compare this draft with Railway/server access logs, crash reporting, analytics, Google Identity, and every transitive Android SDK.
- Enter the public privacy URL and account-deletion URL in Play Console.
- Complete the Target audience, Ads, Content rating, App access, and Data safety sections using production behavior—not planned behavior.
- If an analytics, ads, billing, attribution, or crash-reporting SDK is added, update both this draft and the privacy policy before release.
