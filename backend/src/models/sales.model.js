const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sale = sequelize.define('Sale', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoice_number: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  customer_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  customer_phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0
  },
  tax_amount: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0
  },
  final_amount: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'card', 'bank_transfer', 'credit'),
    defaultValue: 'cash'
  },
  payment_status: {
    type: DataTypes.ENUM('paid', 'pending', 'partial', 'cancelled'),
    defaultValue: 'paid'
  },
  sale_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  profit_total: {
    type: DataTypes.VIRTUAL,
    get() {
      if (this.SaleItems) {
        return this.SaleItems.reduce((sum, item) => {
          return sum + (parseFloat(item.profit || 0) * parseFloat(item.quantity || 0));
        }, 0);
      }
      return 0;
    }
  }
}, {
  tableName: 'sales',
  timestamps: true,
  indexes: [
    { fields: ['invoice_number'] },
    { fields: ['sale_date'] },
    { fields: ['payment_status'] },
    { fields: ['created_by'] }
  ]
});

// توليد رقم فاتورة تلقائي
Sale.beforeCreate(async (sale) => {
  if (!sale.invoice_number) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const lastSale = await Sale.findOne({
      order: [['id', 'DESC']],
      attributes: ['invoice_number']
    });
    
    let sequence = 1;
    if (lastSale && lastSale.invoice_number) {
      const lastSeq = parseInt(lastSale.invoice_number.slice(-4)) || 0;
      sequence = lastSeq + 1;
    }
    
    sale.invoice_number = `INV-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
  }
});

module.exports = Sale;