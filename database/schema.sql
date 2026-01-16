-- SmartStore AI Database Schema
-- بالدينار الليبي 🇱🇾

-- جدول المستخدمين
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    store_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'owner',
    is_active BOOLEAN DEFAULT 1,
    settings TEXT, -- JSON settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول الموردين
CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_number VARCHAR(50),
    payment_terms TEXT,
    rating INTEGER DEFAULT 3,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- جدول المنتجات (المنتجات الأساسية)
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    category VARCHAR(100) NOT NULL DEFAULT 'عام',
    unit VARCHAR(50) NOT NULL DEFAULT 'قطعة',
    purchase_price DECIMAL(10,3) NOT NULL, -- سعر الشراء
    selling_price DECIMAL(10,3) NOT NULL, -- سعر البيع
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    min_quantity DECIMAL(10,3) NOT NULL DEFAULT 5,
    expiry_date DATE,
    supplier_id INTEGER,
    image_url TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- جدول المبيعات
CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    total_amount DECIMAL(10,3) NOT NULL,
    discount_amount DECIMAL(10,3) DEFAULT 0,
    tax_amount DECIMAL(10,3) DEFAULT 0,
    final_amount DECIMAL(10,3) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash',
    payment_status VARCHAR(20) DEFAULT 'paid',
    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- جدول عناصر المبيعات
CREATE TABLE sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,3) NOT NULL,
    total_price DECIMAL(10,3) NOT NULL,
    profit DECIMAL(10,3) GENERATED ALWAYS AS (unit_price - (SELECT purchase_price FROM products WHERE id = product_id)) STORED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- جدول المشتريات
CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    invoice_number VARCHAR(50) UNIQUE,
    total_amount DECIMAL(10,3) NOT NULL,
    tax_amount DECIMAL(10,3) DEFAULT 0,
    shipping_cost DECIMAL(10,3) DEFAULT 0,
    final_amount DECIMAL(10,3) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    purchase_date DATE NOT NULL,
    delivery_date DATE,
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- جدول عناصر المشتريات
CREATE TABLE purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,3) NOT NULL,
    total_price DECIMAL(10,3) NOT NULL,
    expiry_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- جدول حركات المخزون
CREATE TABLE inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    change_type VARCHAR(20) NOT NULL, -- sale, purchase, adjustment, damage, return
    quantity_change DECIMAL(10,3) NOT NULL,
    previous_quantity DECIMAL(10,3) NOT NULL,
    new_quantity DECIMAL(10,3) NOT NULL,
    reference_id INTEGER, -- sale_id or purchase_id
    reference_type VARCHAR(50),
    reason TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- جدول البضائع التالفة
CREATE TABLE damaged_goods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,3) NOT NULL,
    total_loss DECIMAL(10,3) NOT NULL,
    damage_type VARCHAR(50), -- expiry, damage, theft, other
    reason TEXT,
    reported_by INTEGER NOT NULL,
    approved_by INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (reported_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- جدول التقارير
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type VARCHAR(50) NOT NULL, -- daily, monthly, inventory, profit
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data TEXT NOT NULL, -- JSON data
    generated_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- جدول إعدادات النظام
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) DEFAULT 'string',
    category VARCHAR(50) DEFAULT 'general',
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول محادثات الذكاء الاصطناعي
CREATE TABLE ai_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    analysis_data TEXT, -- JSON analysis
    context TEXT, -- JSON context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- إضافة الفهارس لتحسين الأداء
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_expiry ON products(expiry_date);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_user ON sales(created_by);
CREATE INDEX idx_inventory_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_date ON inventory_logs(created_at);

-- إدراج الإعدادات الافتراضية
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
('store_name', 'متجري الذكي', 'string', 'general', 'اسم المتجر'),
('currency', 'LYD', 'string', 'general', 'العملة المستخدمة'),
('currency_symbol', 'د.ل', 'string', 'general', 'رمز العملة'),
('tax_rate', '0', 'decimal', 'financial', 'نسبة الضريبة'),
('default_profit_margin', '25', 'decimal', 'products', 'هامش الربح الافتراضي'),
('low_stock_threshold', '0.2', 'decimal', 'inventory', 'نسبة التحذير من المخزون المنخفض'),
('expiry_warning_days', '7', 'integer', 'inventory', 'أيام التحذير قبل الانتهاء'),
('backup_frequency', 'daily', 'string', 'system', 'تكرر النسخ الاحتياطي');

-- إنشاء المستخدم الافتراضي
INSERT INTO users (username, email, password_hash, full_name, store_name, phone, role) VALUES
('admin', 'admin@smartstore.ly', '$2b$10$YourHashedPasswordHere', 'مدير النظام', 'المتجر الذكي', '0912345678', 'admin');

-- إنشاء فئات منتجات افتراضية
INSERT INTO system_settings (setting_key, setting_value, category) VALUES
('product_categories', 'خضروات,فواكه,معلبات,مشروبات,مستلزمات منزلية,مستلزمات شخصية,حلويات,لحوم,ألبان,خبز', 'products');