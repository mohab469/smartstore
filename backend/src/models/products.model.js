const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  barcode: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      this.setDataValue('name', value.trim());
    }
  },
  name_en: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'عام'
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'قطعة'
  },
  purchase_price: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    comment: 'سعر الشراء بالدينار الليبي'
  },
  selling_price: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    comment: 'سعر البيع بالدينار الليبي'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0
  },
  min_quantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 5
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  supplier_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  profit_margin: {
    type: DataTypes.VIRTUAL,
    get() {
      const purchase = parseFloat(this.purchase_price) || 0;
      const selling = parseFloat(this.selling_price) || 0;
      if (purchase === 0) return 0;
      return ((selling - purchase) / purchase * 100).toFixed(2);
    }
  },
  stock_value: {
    type: DataTypes.VIRTUAL,
    get() {
      const quantity = parseFloat(this.quantity) || 0;
      const purchase = parseFloat(this.purchase_price) || 0;
      return (quantity * purchase).toFixed(3);
    }
  }
}, {
  tableName: 'products',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['barcode'] },
    { fields: ['category'] },
    { fields: ['expiry_date'] },
    { fields: ['is_active'] }
  ]
});

// hooks لتحديث التواريخ
Product.beforeCreate((product) => {
  if (product.expiry_date && new Date(product.expiry_date) < new Date()) {
    throw new Error('تاريخ الانتهاء يجب أن يكون في المستقبل');
  }
});

// scope للاستعلامات الشائعة
Product.addScope('active', {
  where: { is_active: true }
});

Product.addScope('lowStock', {
  where: {
    is_active: true,
    quantity: { [sequelize.Sequelize.Op.lte]: sequelize.Sequelize.col('min_quantity') }
  }
});

Product.addScope('expiringSoon', {
  where: {
    is_active: true,
    expiry_date: {
      [sequelize.Sequelize.Op.between]: [
        new Date(),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 أيام من الآن
      ]
    }
  }
});

module.exports = Product;