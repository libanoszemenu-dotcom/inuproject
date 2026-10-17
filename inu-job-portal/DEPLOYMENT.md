# Deployment guide - Injibara University Recruitment Portal

Stack: React (Vite) + Node.js/Express + MySQL 8 / MariaDB 10.4+. The guide targets one Ubuntu 22.04/24.04 server
with Nginx, PM2 and a free Let's Encrypt certificate. Replace `recruitment.example-inu.edu.et` with the real domain
(the DNS A record must already point to the server's public IP).

## 0. Run it locally first (Windows + XAMPP)

```bash
# 1. Start MySQL in the XAMPP Control Panel, then create the database and tables
mysql -u root < database/schema.sql              # or import it in phpMyAdmin
mysql -u root < database/seed-new-ample-data.sql # OPTIONAL: fictional sample data for development only

# 2. Backend
cd server
copy .env.example .env                           # then edit .env (JWT_SECRET is mandatory)
npm install
npm run migrate                                  # applies database/migrations/002_inu_upgrade.sql (once)
npm run seed:users                               # only if you loaded the sample data (needs SEED_PASSWORD)
npm test                                         # unit tests
npm run dev                                      # http://localhost:5000/api/health

# 3. Frontend (new terminal)
cd client
npm install
npm run dev                                      # http://localhost:5173
```

Order matters: `schema.sql` -> (sample seed) -> `npm run migrate`. Without the sample seed, the migration itself creates
the four roles and the five document types. **Departments are not invented for you**: log in as the administrator and
add the real departments/units under *Departments*, then create Department Head accounts under *Users and roles*.
The very first administrator account must be inserted once by hand (there is no public admin sign-up):

```bash
cd server
node -e "require('bcryptjs').hash(process.argv[1],10).then(h=>console.log(h))" "ChooseAStrongPassw0rd"
```
```sql
INSERT INTO users (role_id, full_name, email, password_hash, email_verified_at)
VALUES ((SELECT id FROM roles WHERE code='admin'), 'System Administrator', 'admin@your-domain', '<paste hash>', NOW());
```

## 1. Prepare the server

```bash
sudo apt update && sudo apt install -y nginx mysql-server git ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 2. Database

```bash
sudo mysql
```
```sql
CREATE USER 'inu_app'@'localhost' IDENTIFIED BY 'a-long-random-password';
-- schema.sql creates the database; grant the application user rights on it only
GRANT ALL PRIVILEGES ON recruitment_db.* TO 'inu_app'@'localhost';
FLUSH PRIVILEGES;
```
```bash
sudo mysql < database/schema.sql          # do NOT load the sample seed in production
```

## 3. Get the code and configure it

```bash
sudo mkdir -p /opt/inu-recruitment && sudo chown $USER /opt/inu-recruitment
git clone <your repository> /opt/inu-recruitment && cd /opt/inu-recruitment/server
cp .env.example .env && nano .env
```
Set at least: `NODE_ENV=production`, `CLIENT_ORIGIN=https://recruitment.example-inu.edu.et`, `DB_USER=inu_app`,
`DB_PASSWORD`, `JWT_SECRET` (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`),
`UPLOAD_DIR=/var/inu-recruitment/uploads`, the `SMTP_*` values and `MAIL_FROM`, and `GOOGLE_CLIENT_ID` (step 9).
The server refuses to start in production if `CLIENT_ORIGIN` is not https or `DB_PASSWORD` is empty.

```bash
sudo mkdir -p /var/inu-recruitment/uploads && sudo chown $USER /var/inu-recruitment/uploads && chmod 700 /var/inu-recruitment/uploads
chmod 600 .env
npm install --omit=dev
npm run migrate
```

## 4. Start the API with PM2

```bash
cd /opt/inu-recruitment
pm2 start deploy/ecosystem.config.js --env production
pm2 save
pm2 startup systemd       # run the command it prints, so the API restarts after a reboot
curl http://127.0.0.1:5000/api/health      # {"success":true,"data":{"status":"ok",...}}
pm2 logs inu-recruitment-api
```

## 5. Build the frontend

```bash
cd /opt/inu-recruitment/client
npm ci
npm run build                               # creates client/dist
sudo mkdir -p /var/www/inu-recruitment
sudo rsync -a --delete dist/ /var/www/inu-recruitment/
```

## 6. Nginx reverse proxy

```bash
sudo cp /opt/inu-recruitment/deploy/nginx.conf /etc/nginx/sites-available/inu-recruitment
sudo nano /etc/nginx/sites-available/inu-recruitment      # replace the domain name
sudo ln -s /etc/nginx/sites-available/inu-recruitment /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```
The `ssl_certificate` lines refer to files that do not exist yet, so do step 7 first.

## 7. HTTPS certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
# temporary: comment out the whole "listen 443" server block, then
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --nginx -d recruitment.example-inu.edu.et
# restore the 443 block, then
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --dry-run                # automatic renewal is installed by the package
```
Open `https://recruitment.example-inu.edu.et`. Cookies are `Secure` + `HttpOnly` in production, so the site only works over HTTPS.

## 8. Backups (do this before real applicants use the system)

```bash
sudo mkdir -p /var/backups/inu && sudo chmod 700 /var/backups/inu
sudo crontab -e
# every night at 02:00: database dump + uploaded documents, keep 14 days
0 2 * * * mysqldump --single-transaction recruitment_db | gzip > /var/backups/inu/db-$(date +\%F).sql.gz && tar czf /var/backups/inu/files-$(date +\%F).tgz -C /var/inu-recruitment uploads && find /var/backups/inu -mtime +14 -delete
```
Copy the backups to another machine as well, and test a restore at least once.

## 9. Google sign-in (optional)

1. Google Cloud Console -> *APIs & Services* -> *Credentials* -> *Create credentials* -> *OAuth client ID* -> **Web application**.
2. *Authorised JavaScript origins*: `https://recruitment.example-inu.edu.et` (and `http://localhost:5173` for development).
3. Copy the client ID into `GOOGLE_CLIENT_ID` in `server/.env`, then `pm2 restart inu-recruitment-api`.
4. Configure the OAuth consent screen. The button appears on the login and register pages automatically; without a client ID it stays hidden.

## 10. Updating later

```bash
cd /opt/inu-recruitment && git pull
cd server && npm install --omit=dev && npm run migrate && pm2 restart inu-recruitment-api
cd ../client && npm ci && npm run build && sudo rsync -a --delete dist/ /var/www/inu-recruitment/
```

## Checklist before go-live

- [ ] `.env` is not in Git; the old `JWT_SECRET` from earlier versions was replaced by a new random one
- [ ] First administrator created; real departments added; Department Head accounts created and given a department
- [ ] SMTP works: register a test applicant and receive the verification email
- [ ] HTTPS works and `http://` redirects to `https://`
- [ ] Nightly backup ran and a restore was tested
- [ ] Sample accounts (`@example.test`) do not exist in the production database
