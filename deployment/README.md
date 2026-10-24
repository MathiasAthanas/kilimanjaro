# Production Recovery Controls

`activate-production-release.sh` is the production activation path. It installs exact locked dependencies, restores service configuration from `/etc/kilimanjaro/services`, builds each service, verifies compiled entry points and Prisma clients, then atomically switches `/opt/kilimanjaro/app`. It rolls back the symlink if the gateway health check fails. It never runs database migrations automatically.

`kilimanjaro-healthcheck.sh` is installed at `/usr/local/sbin/kilimanjaro-healthcheck` and run by the matching systemd timer. It checks PM2 application state and gateway health once per minute. It restarts only unhealthy applications, with a five-minute per-service cooldown, so a broken release cannot create a hot restart loop.

Persistent production service configuration is stored outside releases in `/etc/kilimanjaro/services/<service>.env`, owned by `root:kilimanjaro` with mode `640`. The activation script copies each file into a new release with mode `600` immediately before building.

After changing either shell script, run `bash -n deployment/<script>.sh` before installing it on the server. Do not print, commit, or copy the contents of production `.env` files into the repository.
