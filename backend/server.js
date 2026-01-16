const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// تحميل المتغيرات البيئية
dotenv.config();

// إنشاء تطبيق Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات الثابتة
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// مسارات API الأساسية
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/products', require('./src/routes/product.routes'));
app.use('/api/sales', require('./src/routes/sale.routes'));
app.use('/api/inventory', require('./src/routes/inventory.routes'));
app.use('/api/ai', require('./src/routes/ai.routes'));
app.use('/api/reports', require('./src/routes/report.routes'));

// صفحة الترحيب
app.get('/', (req, res) => {
  res.json({
    message: 'مرحباً بكم في SmartStore AI 🇱🇾',
    version: '1.0.0',
    description: 'نظام إدارة المتاجر الغذائية المدعوم بالذكاء الاصطناعي'
  });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'حدث خطأ في الخادم',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`
  ============================================
  🚀 SmartStore AI يعمل على المنفذ ${PORT}
  ============================================
  🇱🇾 نظام إدارة المتاجر الغذائية الليبية
  🤖 مدعوم بالذكاء الاصطناعي
  💰 بالدينار الليبي
  ============================================
  `);
});

module.exports = app;