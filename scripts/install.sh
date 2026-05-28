set -e

echo "=== Початок розгортання Simple Inventory ==="

echo "1. Створення користувачів..."

id -u student &>/dev/null || useradd -m -s /bin/bash -G sudo student

id -u teacher &>/dev/null || useradd -m -s /bin/bash -G sudo teacher
usermod -p $(openssl passwd -1 12345678) teacher
chage -d 0 teacher

id -u app &>/dev/null || useradd -r -s /bin/false app

id -u operator &>/dev/null || useradd -m -s /bin/bash -g operator operator 2>/dev/null || useradd -m -s /bin/bash operator
usermod -p $(openssl passwd -1 12345678) operator
chage -d 0 operator

echo "operator ALL=(ALL) NOPASSWD: /bin/systemctl start mywebapp, /bin/systemctl stop mywebapp, /bin/systemctl restart mywebapp, /bin/systemctl status mywebapp, /bin/systemctl reload nginx" > /etc/sudoers.d/operator

echo "2. Оновлення системи та встановлення пакетів..."
apt-get update
apt-get install -y nginx mariadb-server curl sudo

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "3. Налаштування MariaDB..."
systemctl start mariadb
systemctl enable mariadb

mysql -e "CREATE DATABASE IF NOT EXISTS simple_inventory;"
mysql -e "CREATE USER IF NOT EXISTS 'app'@'localhost' IDENTIFIED BY 'password';"
mysql -e "GRANT ALL PRIVILEGES ON simple_inventory.* TO 'app'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "4. Копіювання коду застосунку..."
mkdir -p /opt/mywebapp

cp -r ../app/* /opt/mywebapp/

cd /opt/mywebapp
npm install

chown -R app:app /opt/mywebapp

echo "5. Створення systemd-сервісу та сокета..."

cat <<EOF > /etc/systemd/system/mywebapp.socket
[Unit]
Description=My Simple Inventory Web App Socket

[Socket]
ListenStream=127.0.0.1:8080

[Install]
WantedBy=sockets.target
EOF

cat <<EOF > /etc/systemd/system/mywebapp.service
[Unit]
Description=My Simple Inventory Web App
Requires=mywebapp.socket
After=network.target mariadb.service mywebapp.socket

[Service]
Type=simple
User=app
WorkingDirectory=/opt/mywebapp
ExecStartPre=/usr/bin/node /opt/mywebapp/migrate.js --db-user=app --db-pass=password
# Node.js автоматично підхопить сокет від systemd
ExecStart=/usr/bin/node /opt/mywebapp/app.js --db-user=app --db-pass=password
Restart=on-failure
NonBlocking=true
EOF

systemctl daemon-reload

systemctl stop mywebapp.service || true
systemctl disable mywebapp.service || true

systemctl enable mywebapp.socket
systemctl start mywebapp.socket

echo "6. Налаштування Nginx..."
cat <<EOF > /etc/nginx/sites-available/default
server {
    listen 80;
    server_name _;

    # Відкриваємо кореневий ендпоінт
    location = / {
        proxy_pass http://127.0.0.1:8080;
    }

    # Відкриваємо ендпоінти API
    location /items {
        proxy_pass http://127.0.0.1:8080;
    }

    # Блокуємо доступ до health check ззовні
    location /health {
        return 404;
    }

    # Блокуємо все інше
    location / {
        return 404;
    }
}
EOF

systemctl reload nginx

echo "7. Фінальні налаштування..."
echo "99" > /home/student/gradebook

usermod -L ubuntu || true 

echo "=== Розгортання успішно завершено! ==="