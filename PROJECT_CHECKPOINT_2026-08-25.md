# Project Checkpoint - 2026-08-25

Purpose: checkpoint the current Kilimanjaro project and VPS state before hosting another project on the same VPS under a separate subdomain.

## Local Repo State

- Workspace: `C:\Users\MICROSPACE\Desktop\kilimanjaro`
- Branch: `main`
- Current git HEAD: `a87c805`
- Important note: the local worktree has many modified and untracked files from ongoing project work. No git commit or tag was created for this checkpoint because it would mix unrelated changes.
- Main deployment report: `DEPLOYMENT_REPORT_2026-08-24.md`

## Production VPS

- VPS IP: `179.198.193.172`
- SSH command:
  - `ssh -i $HOME\.ssh\kilimanjaro root@179.198.193.172`
- Hostname: `srv1912213`
- Existing production domains on this VPS:
  - `manage.kilimanjaroschools.site`
  - `srms.kilimanjaroschools.site`
- Existing enabled Nginx site files:
  - `/etc/nginx/sites-enabled/kilimanjaro-manage`
  - `/etc/nginx/sites-enabled/kilimanjaro-srms`
- Existing app path:
  - `/opt/kilimanjaro/app`
- Existing dashboard web root:
  - `/var/www/kilimanjaro-manage`

## Current Health Verification

Checked on `2026-08-25`:

- `https://manage.kilimanjaroschools.site` returns HTTP `200`.
- `https://srms.kilimanjaroschools.site/health` returns `status: ok`.
- Gateway health reports these services reachable:
  - `auth`
  - `students`
  - `academics`
  - `finance`
  - `notifications`
  - `analytics`
- Nginx config test passes with `nginx -t`.
- Base services are active:
  - `postgresql`
  - `redis-server`
  - `rabbitmq-server`
  - `nginx`
- UFW is active and only allows inbound:
  - SSH / `22`
  - HTTP / `80`
  - HTTPS / `443`

## PM2 Backend State

All existing Kilimanjaro backend processes are online under the `kilimanjaro` user:

- `ks-api-gateway`
- `ks-auth-service`
- `ks-student-service`
- `ks-academic-service`
- `ks-finance-service`
- `ks-notification-service`
- `ks-analytics-service`
- `ks-elearning-service`

Observed note: `ks-finance-service` had restart count `31`, but it was online during the checkpoint.

## TLS

- Certbot is installed and configured.
- Certificate covers:
  - `manage.kilimanjaroschools.site`
  - `srms.kilimanjaroschools.site`
- Expiry reported: `2026-11-22`
- Certbot email used during Kilimanjaro setup: `athanas.mathy@gmail.com`

## Production Accounts Created

Passwords are intentionally not stored in this checkpoint.

- `athanas.mathy@gmail.com` - `SUPER_ADMIN`
- `sanga@teyora.co.tz` - `SUPER_ADMIN`
- `teyoraadmin@teyora.co.tz` - `SYSTEM_ADMIN`
- `ben@teyora.co.tz` - `SUPER_ADMIN`
- `benadmin@teyora.co.tz` - `SYSTEM_ADMIN`

The Ben accounts were verified through the production UI:

- `ben@teyora.co.tz` logs in and routes to `/superadmin`.
- `benadmin@teyora.co.tz` logs in and routes to `/admin`.
- Refresh tokens created by verification logins were revoked.

## Constraints For Hosting Another Project

Use a separate subdomain and do not disturb the existing Kilimanjaro Nginx sites.

Recommended structure for the next project:

- App source/runtime: `/opt/<new-project-name>/app`
- Static web root, if frontend-only: `/var/www/<new-project-name>`
- Logs: `/var/log/<new-project-name>`
- PM2 process names should not start with `ks-` unless the new project is part of Kilimanjaro.
- Nginx site file:
  - `/etc/nginx/sites-available/<new-project-name>`
  - symlink to `/etc/nginx/sites-enabled/<new-project-name>`
- Bind backend apps to `127.0.0.1:<private-port>` and expose only through Nginx.
- Keep UFW limited to `22`, `80`, and `443` unless there is a strong reason to open another port.
- Use Certbot for the new subdomain after DNS points to `179.198.193.172`.

## Existing Limitations

- Outbound email, SMS, and Firebase push credentials were not provided for Kilimanjaro, so external notification delivery remains disabled/mock.
- `student-service` and `academic-service` migration histories still need cleanup for pure clean-DB `prisma migrate deploy`.
- npm audit vulnerabilities exist in both backend and dashboard dependency trees and should be remediated separately.

