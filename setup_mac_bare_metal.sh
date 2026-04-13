#!/bin/bash
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "🚀 Bắt đầu cài đặt InvenTree Bare Metal cho macOS..."

# 1. Cài đặt các gói hệ thống cần thiết qua Homebrew
echo "1. Đang cài đặt các dependencies (PostgreSQL, Redis, Python 3.11, Pango/Cairo)..."
brew install python@3.11 postgresql@14 redis pango glib cairo pkg-config || true

# 2. Khởi động PostgreSQL và Redis
echo "2. Khởi động Redis và PostgreSQL services..."
brew services start redis || true
brew services start postgresql@14 || true

echo "Đang chờ Database khởi động (3 giây)..."
sleep 3

# 3. Thiết lập User/Database trên PostgreSQL
echo "3. Thiết lập Database PostgreSQL..."
# Đường dẫn an toàn tới psql của postgresql@14
PSQL_BIN=$(brew --prefix postgresql@14)/bin/psql
CREATEUSER_BIN=$(brew --prefix postgresql@14)/bin/createuser

# Tạo tài khoản postgres nếu chưa tồn tại
$CREATEUSER_BIN -s postgres || true

# Thực thi các lệnh tạo Database và phân quyền
$PSQL_BIN -d postgres -c "CREATE DATABASE inventree;" || true
$PSQL_BIN -d postgres -c "CREATE USER inventree WITH PASSWORD 'inventree';" || true
$PSQL_BIN -d postgres -c "ALTER ROLE inventree SET client_encoding TO 'utf8';" || true
$PSQL_BIN -d postgres -c "ALTER ROLE inventree SET default_transaction_isolation TO 'read committed';" || true
$PSQL_BIN -d postgres -c "ALTER ROLE inventree SET timezone TO 'UTC';" || true
$PSQL_BIN -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE inventree TO inventree;" || true
$PSQL_BIN -d inventree -c "GRANT ALL ON SCHEMA public TO inventree;" || true

# 4. Thiết lập file cấu hình
echo "4. Tạo thư mục cấu hình data/config.yaml..."
mkdir -p data data/media data/static data/backup
if [ ! -f "data/config.yaml" ]; then
    cp src/backend/InvenTree/config_template.yaml data/config.yaml || true
    
    # Update config.yaml to use PostgreSQL and Redis via sed
    # Note: macOS requires '' for in-place edit using sed
    sed -i '' 's/INVENTREE_DB_ENGINE: sqlite3/INVENTREE_DB_ENGINE: postgresql/' data/config.yaml
    sed -i '' 's/INVENTREE_DB_NAME: inventree_db/INVENTREE_DB_NAME: inventree/' data/config.yaml
    sed -i '' 's/INVENTREE_DB_USER:.*/INVENTREE_DB_USER: inventree/' data/config.yaml
    sed -i '' 's/INVENTREE_DB_PASSWORD:.*/INVENTREE_DB_PASSWORD: inventree/' data/config.yaml
    sed -i '' 's/# INVENTREE_DB_HOST:.*/INVENTREE_DB_HOST: localhost/' data/config.yaml
    sed -i '' 's/# INVENTREE_DB_PORT:.*/INVENTREE_DB_PORT: 5432/' data/config.yaml
    sed -i '' 's/# INVENTREE_CACHE_BACKEND: local/INVENTREE_CACHE_BACKEND: redis/' data/config.yaml
    sed -i '' 's/# INVENTREE_CACHE_HOST:.*/INVENTREE_CACHE_HOST: localhost/' data/config.yaml
    sed -i '' 's/# INVENTREE_CACHE_PORT:.*/INVENTREE_CACHE_PORT: 6379/' data/config.yaml
    sed -i '' "s|#media_root: '/home/inventree/data/media'|media_root: '$PWD/data/media'|" data/config.yaml
    sed -i '' "s|#static_root: '/home/inventree/data/static'|static_root: '$PWD/data/static'|" data/config.yaml
    sed -i '' "s|#backup_dir: '/home/inventree/data/backup'|backup_dir: '$PWD/data/backup'|" data/config.yaml
fi

# Thiết lập biến môi trường trỏ đến cấu hình
export INVENTREE_CONFIG_FILE=$PWD/data/config.yaml

# 5. Tạo và kích hoạt môi trường ảo Python (VENV)
echo "5. Tạo môi trường ảo (Virtual Environment) và cài Python packages..."
$(brew --prefix python@3.11)/bin/python3.11 -m venv env
source env/bin/activate

echo "Cập nhật pip và cài invoke..."
pip install --upgrade pip setuptools wheel
pip install invoke psycopg2-binary redis

# 6. Cài đặt các gói InvenTree
echo "6. Chạy quá trình cài đặt InvenTree (invoke install)..."
invoke install

# 7. Migrate Database
echo "7. Cập nhật và Migrate cơ sở dữ liệu (invoke update)..."
invoke update

echo ""
echo "=========================================================="
echo "✅ Cài đặt INVENTREE (BARE METAL MAC OS) HOÀN TẤT!"
echo "=========================================================="
echo "👉 Để tạo tài khoản Admin, chạy từng lệnh sau:"
echo "   source env/bin/activate && export INVENTREE_CONFIG_FILE=$PWD/data/config.yaml"
echo "   invoke superuser"
echo ""
echo "👉 Để chạy Server lên để dùng, chạy từng lệnh:"
echo "   source env/bin/activate && export INVENTREE_CONFIG_FILE=$PWD/data/config.yaml"
echo "   invoke server"
echo "=========================================================="
