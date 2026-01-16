const { Sequelize } = require('sequelize');
const path = require('path');

// إنشاء اتصال قاعدة البيانات
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DB_PATH || path.join(__dirname, '../../database/smartstore.db'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    paranoid: true, // لحذف البيانات بشكل منطقي
    underscored: true, // استخدام snake_case في قاعدة البيانات
    charset: 'utf8',
    collate: 'utf8_general_ci'
  },
  dialectOptions: {
    useUTC: true
  },
  timezone: '+02:00', // توقيت ليبيا
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// دالة لاختبار الاتصال
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ اتصال قاعدة البيانات ناجح');
    
    // مزامنة النماذج
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ تم مزامنة نماذج قاعدة البيانات');
    
    return true;
  } catch (error) {
    console.error('❌ خطأ في اتصال قاعدة البيانات:', error.message);
    return false;
  }
};

module.exports = { sequelize, testConnection };