const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SaleItem = sequelize.define('SaleItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sales',
      key: 'id'
    }
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    validate: {
      min: 0.001
    }
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  purchase_price: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  profit: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0
  },
  profit_percentage: {
    type: DataTypes.VIRTUAL,
    get() {
      const purchase = parseFloat(this.purchase_price) || 0;
      const selling = parseFloat(this.unit_price) || 0;
      if (purchase === 0) return 0;
      return ((selling - purchase) / purchase * 100).toFixed(2);
    }
  }
}, {
  tableName: 'sale_items',
  timestamps: true
});

// حساب الأرباح تلقائياً
SaleItem.beforeSave(async (item) => {
  if (item.quantity && item.unit_price && item.purchase_price) {
    item.total_price = parseFloat(item.quantity) * parseFloat(item.unit_price);
    item.profit = (parseFloat(item.unit_price) - parseFloat(item.purchase_price)) * parseFloat(item.quantity);
  }
});

module.exports = SaleItem;