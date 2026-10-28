# Login Classroom Image Deployment Report

## Change

- Added the user-supplied classroom photograph to the left side of the staff login page.
- Converted the source JPEG to a metadata-free, 1600 x 1068 WebP for efficient delivery.
- Added a solid navy readability overlay and retained the school identity, portal message, and version information over the image.
- Preserved a focused, image-free mobile login layout.
- Corrected malformed legacy punctuation in the login copy and password placeholder.

## Source

- Implementation commit: `fa3df9e` (`feat(dashboard): add classroom image to login`)
- Branch: `main`
- Remote: `origin/main`
- Asset: `dashboard/public/images/login-classroom.webp`
- Asset size: 157,450 bytes
- Asset SHA-256: `a160e49b6f653fc0fda163cf0fdf9df4773976196b3f7165e64ff6af89c9d673`

## Verification

- Dashboard TypeScript check: passed.
- Scoped ESLint check: passed.
- Authentication and password visibility tests: 3 passed.
- Production dashboard build: passed.
- Local desktop visual check at 1440 x 1000: passed.
- Local compact visual check at 500 x 844: passed.
- Production desktop render: passed after allowing the remote image to finish painting.
- Production image matched the local asset byte-for-byte by SHA-256.
- Production image response: HTTP 200, `image/webp`, 157,450 bytes.

## Production Deployment

- Frontend: `https://manage.kilimanjaroschools.site/login`
- Backend health returned `status: ok` with every dependency reachable.
- Nginx configuration test: passed.
- All eight PM2 backend services remained online.
- Rollback archive: `/opt/kilimanjaro/storage/backups/dashboard-pre-fa3df9e-20261028T105721Z.tar.gz`
- Previous frontend directory: `/var/www/kilimanjaro-manage-previous-20261028T105721Z`
- Uploaded dashboard archive SHA-256: `27cb8f7ae88c946302f6bcf431bd09a51445c16b0c1fbb318b56f10a7cb134de`

## Data Impact

- No database migration was required.
- No production data was changed.
- No backend process restart was required.

