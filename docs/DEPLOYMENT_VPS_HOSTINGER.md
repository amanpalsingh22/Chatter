# Chatter VPS + Hostinger Deployment

This app is deployed as one Node/Express service:

- Express API: `/api`
- Socket.IO: `/socket.io`
- React build: served by Express from `frontend/dist`
- Process manager: PM2
- Reverse proxy and SSL: Nginx + Certbot

Replace these placeholders before running commands:

- `yourdomain.com`
- `www.yourdomain.com`
- `YOUR_VPS_IP`
- `amanpalsingh22/Chatter.git` if your GitHub repo changes

## 1. Point Hostinger DNS to the VPS

In Hostinger hPanel:

1. Open **Domains**.
2. Open **Domain Portfolio**.
3. Click **Manage** on your domain.
4. Open **DNS / Nameservers**.
5. In DNS records, set:

```txt
Type  Name  Value        TTL
A     @     YOUR_VPS_IP  default
CNAME www   yourdomain.com default
```

If Hostinger does not allow `@`, use your root domain name in the Name field.

Wait for DNS propagation. It can be quick, but allow up to 24 hours.

## 2. SSH into the VPS

From your local terminal:

```bash
ssh root@YOUR_VPS_IP
```

If you created a non-root user, use that username instead.

## 3. Update server packages

```bash
sudo apt update
sudo apt upgrade -y
```

## 4. Install required system packages

```bash
sudo apt install -y git curl nginx ufw
```

## 5. Install Node.js with nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
node -v
npm -v
```

## 6. Install PM2

```bash
npm install -g pm2
pm2 -v
```

## 7. Clone the project

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/amanpalsingh22/Chatter.git chatter
cd chatter
```

For future updates:

```bash
cd /var/www/chatter
git pull origin main
```

## 8. Create backend production environment

```bash
cp backend/.env.production.example backend/.env
nano backend/.env
```

Set real values:

```env
NODE_ENV=production
PORT=5001
CLIENT_URL=https://yourdomain.com,https://www.yourdomain.com
MONGODB_URI=mongodb+srv://...
JWT_SECRET=use-a-long-random-secret
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 9. Build the app

```bash
npm run build
```

This installs backend and frontend dependencies, then builds `frontend/dist`.

## 10. Start app with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs chatter
```

Press `Ctrl+C` to exit logs.

Make PM2 restart after reboot:

```bash
pm2 startup
```

PM2 will print a `sudo env ... pm2 startup ...` command. Copy and run exactly what it prints.

Then:

```bash
pm2 save
```

## 11. Configure Nginx

Create site config:

```bash
sudo nano /etc/nginx/sites-available/chatter
```

Paste the contents of `deploy/nginx-chatter.conf.example`, replacing `yourdomain.com`.

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/chatter /etc/nginx/sites-enabled/chatter
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 12. Open firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 13. Test HTTP

Open:

```txt
http://yourdomain.com
```

If it loads, continue to SSL.

## 14. Add SSL with Certbot

```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

## 15. Test production app

Open:

```txt
https://yourdomain.com
```

Check:

- Signup/login
- Direct messages
- Group messages
- Shared notebook
- Socket features: online badge, typing, pulse
- Profile image upload

## 16. Update deployment later

Every time you push new code to GitHub:

```bash
ssh root@YOUR_VPS_IP
cd /var/www/chatter
git pull origin main
npm run build
pm2 restart chatter
pm2 logs chatter
```

## Useful debugging

Backend logs:

```bash
pm2 logs chatter
```

Nginx errors:

```bash
sudo tail -f /var/log/nginx/error.log
```

Check port:

```bash
sudo ss -tulpn | grep 5001
```

Restart everything:

```bash
pm2 restart chatter
sudo systemctl restart nginx
```
