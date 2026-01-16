const Sale = require('../models/sales.model');
const SaleItem = require('../models/saleItems.model');
const Product = require('../models/products.model');
const { Op } = require('sequelize');
const moment = require('moment');

class SaleController {
  // إنشاء فاتورة بيع جديدة
  static async createSale(req, res) {
    const transaction = await require('../config/database').sequelize.transaction();
    
    try {
      const {
        items,
        customer_name,
        customer_phone,
        discount_amount = 0,
        tax_amount = 0,
        payment_method = 'cash',
        notes
      } = req.body;

      // التحقق من البيانات
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'يجب إضافة منتجات للفاتورة'
        });
      }

      let totalAmount = 0;
      const saleItems = [];

      // التحقق من المخزون وتجهيز العناصر
      for (const item of items) {
        const product = await Product.findByPk(item.product_id, { transaction });
        
        if (!product) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: `المنتج برقم ${item.product_id} غير موجود`
          });
        }

        if (parseFloat(product.quantity) < parseFloat(item.quantity)) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `المخزون غير كافٍ للمنتج: ${product.name}. المتوفر: ${product.quantity}`
          });
        }

        const unitPrice = parseFloat(item.unit_price) || parseFloat(product.selling_price);
        const totalPrice = parseFloat(item.quantity) * unitPrice;
        
        saleItems.push({
          product_id: item.product_id,
          quantity: parseFloat(item.quantity),
          unit_price: unitPrice,
          total_price: totalPrice,
          purchase_price: product.purchase_price,
          profit: (unitPrice - product.purchase_price) * parseFloat(item.quantity)
        });

        totalAmount += totalPrice;
      }

      // حساب المبلغ النهائي
      const finalAmount = totalAmount - parseFloat(discount_amount) + parseFloat(tax_amount);

      // إنشاء الفاتورة
      const sale = await Sale.create({
        customer_name,
        customer_phone,
        total_amount: totalAmount,
        discount_amount: parseFloat(discount_amount),
        tax_amount: parseFloat(tax_amount),
        final_amount: finalAmount,
        payment_method,
        payment_status: 'paid',
        sale_date: new Date(),
        notes,
        created_by: req.user.id
      }, { transaction });

      // إضافة عناصر الفاتورة
      for (const itemData of saleItems) {
        await SaleItem.create({
          ...itemData,
          sale_id: sale.id
        }, { transaction });

        // تحديث المخزون
        const product = await Product.findByPk(itemData.product_id, { transaction });
        await product.decrement('quantity', {
          by: itemData.quantity,
          transaction
        });

        // تسجيل حركة المخزون
        await require('../models/inventoryLogs.model').create({
          product_id: itemData.product_id,
          change_type: 'sale',
          quantity_change: -itemData.quantity,
          previous_quantity: parseFloat(product.quantity) + parseFloat(itemData.quantity),
          new_quantity: parseFloat(product.quantity),
          reference_id: sale.id,
          reference_type: 'sale',
          reason: `بيع عبر الفاتورة ${sale.invoice_number}`,
          created_by: req.user.id
        }, { transaction });
      }

      await transaction.commit();

      // جلب الفاتورة مع تفاصيلها
      const saleWithDetails = await Sale.findByPk(sale.id, {
        include: [
          {
            model: SaleItem,
            include: [Product]
          }
        ],
        transaction
      });

      res.status(201).json({
        success: true,
        message: 'تم إنشاء الفاتورة بنجاح',
        data: saleWithDetails,
        summary: {
          total_items: saleItems.length,
          total_quantity: saleItems.reduce((sum, item) => sum + parseFloat(item.quantity), 0),
          total_profit: saleItems.reduce((sum, item) => sum + parseFloat(item.profit), 0).toFixed(3)
        }
      });
    } catch (error) {
      await transaction.rollback();
      console.error('خطأ في إنشاء الفاتورة:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في إنشاء الفاتورة',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // جلب تقرير المبيعات
  static async getSalesReport(req, res) {
    try {
      const {
        start_date,
        end_date,
        group_by = 'day', // day, week, month, category, product
        payment_method,
        min_amount,
        max_amount
      } = req.query;

      const where = {};
      
      // فلترة حسب التاريخ
      if (start_date && end_date) {
        where.sale_date = {
          [Op.between]: [
            moment(start_date).startOf('day').toDate(),
            moment(end_date).endOf('day').toDate()
          ]
        };
      } else {
        // افتراضي آخر 30 يوم
        where.sale_date = {
          [Op.gte]: moment().subtract(30, 'days').toDate()
        };
      }

      if (payment_method) where.payment_method = payment_method;
      if (min_amount) where.final_amount = { [Op.gte]: parseFloat(min_amount) };
      if (max_amount) {
        where.final_amount = where.final_amount || {};
        where.final_amount[Op.lte] = parseFloat(max_amount);
      }

      const sales = await Sale.findAll({
        where,
        include: [
          {
            model: SaleItem,
            include: [Product],
            required: true
          }
        ],
        order: [['sale_date', 'DESC']]
      });

      // تحليل البيانات حسب المجموعة المطلوبة
      let analysis = {};
      
      switch (group_by) {
        case 'day':
          analysis = this.analyzeByDay(sales);
          break;
        case 'week':
          analysis = this.analyzeByWeek(sales);
          break;
        case 'month':
          analysis = this.analyzeByMonth(sales);
          break;
        case 'category':
          analysis = await this.analyzeByCategory(sales);
          break;
        case 'product':
          analysis = await this.analyzeByProduct(sales);
          break;
        default:
          analysis = this.analyzeByDay(sales);
      }

      // إحصائيات عامة
      const stats = {
        total_sales: sales.length,
        total_revenue: sales.reduce((sum, sale) => sum + parseFloat(sale.final_amount), 0).toFixed(3),
        total_profit: sales.reduce((sum, sale) => sum + parseFloat(sale.profit_total || 0), 0).toFixed(3),
        average_sale: (sales.reduce((sum, sale) => sum + parseFloat(sale.final_amount), 0) / sales.length || 0).toFixed(3),
        best_day: this.findBestDay(sales),
        payment_methods: this.analyzePaymentMethods(sales)
      };

      res.json({
        success: true,
        data: analysis,
        statistics: stats,
        period: {
          start_date: start_date || moment().subtract(30, 'days').format('YYYY-MM-DD'),
          end_date: end_date || moment().format('YYYY-MM-DD'),
          group_by
        }
      });
    } catch (error) {
      console.error('خطأ في إنشاء تقرير المبيعات:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في إنشاء التقرير'
      });
    }
  }

  // تحليل حسب اليوم
  static analyzeByDay(sales) {
    const days = {};
    
    sales.forEach(sale => {
      const date = moment(sale.sale_date).format('YYYY-MM-DD');
      
      if (!days[date]) {
        days[date] = {
          date,
          total_sales: 0,
          total_revenue: 0,
          total_profit: 0,
          transaction_count: 0,
          items: []
        };
      }
      
      days[date].total_sales += 1;
      days[date].total_revenue += parseFloat(sale.final_amount);
      days[date].total_profit += parseFloat(sale.profit_total || 0);
      days[date].transaction_count += 1;
      
      if (sale.SaleItems) {
        sale.SaleItems.forEach(item => {
          days[date].items.push({
            product: item.Product.name,
            quantity: item.quantity,
            revenue: item.total_price,
            profit: item.profit
          });
        });
      }
    });

    // تحويل إلى مصفوفة وترتيب حسب التاريخ
    return Object.values(days).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // تحليل حسب الفئة
  static async analyzeByCategory(sales) {
    const categories = {};
    
    for (const sale of sales) {
      if (sale.SaleItems) {
        for (const item of sale.SaleItems) {
          const category = item.Product.category;
          
          if (!categories[category]) {
            categories[category] = {
              category,
              total_revenue: 0,
              total_profit: 0,
              total_quantity: 0,
              product_count: 0,
              products: {}
            };
          }
          
          categories[category].total_revenue += parseFloat(item.total_price);
          categories[category].total_profit += parseFloat(item.profit || 0);
          categories[category].total_quantity += parseFloat(item.quantity);
          categories[category].product_count += 1;
          
          // تتبع المنتجات داخل الفئة
          if (!categories[category].products[item.Product.name]) {
            categories[category].products[item.Product.name] = {
              name: item.Product.name,
              total_revenue: 0,
              total_quantity: 0
            };
          }
          
          categories[category].products[item.Product.name].total_revenue += parseFloat(item.total_price);
          categories[category].products[item.Product.name].total_quantity += parseFloat(item.quantity);
        }
      }
    }

    // تحويل المنتجات إلى مصفوفة وترتيبها
    Object.keys(categories).forEach(category => {
      categories[category].products = Object.values(categories[category].products)
        .sort((a, b) => b.total_revenue - a.total_revenue);
    });

    return Object.values(categories).sort((a, b) => b.total_revenue - a.total_revenue);
  }

  // تحليل حسب المنتج
  static async analyzeByProduct(sales) {
    const products = {};
    
    for (const sale of sales) {
      if (sale.SaleItems) {
        for (const item of sale.SaleItems) {
          const productName = item.Product.name;
          
          if (!products[productName]) {
            products[productName] = {
              name: productName,
              category: item.Product.category,
              total_revenue: 0,
              total_profit: 0,
              total_quantity: 0,
              sale_count: 0,
              average_profit_margin: 0,
              days: {}
            };
          }
          
          products[productName].total_revenue += parseFloat(item.total_price);
          products[productName].total_profit += parseFloat(item.profit || 0);
          products[productName].total_quantity += parseFloat(item.quantity);
          products[productName].sale_count += 1;
          
          // تتبع حسب اليوم
          const date = moment(sale.sale_date).format('YYYY-MM-DD');
          if (!products[productName].days[date]) {
            products[productName].days[date] = {
              date,
              quantity: 0,
              revenue: 0
            };
          }
          products[productName].days[date].quantity += parseFloat(item.quantity);
          products[productName].days[date].revenue += parseFloat(item.total_price);
        }
      }
    }

    // حساب متوسط هامش الربح وتحويل الأيام إلى مصفوفة
    Object.keys(products).forEach(productName => {
      const product = products[productName];
      product.average_profit_margin = product.total_quantity > 0 ? 
        (product.total_profit / (product.total_revenue - product.total_profit) * 100).toFixed(2) : 0;
      product.days = Object.values(product.days).sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    return Object.values(products).sort((a, b) => b.total_revenue - a.total_revenue);
  }

  // إيجاد أفضل يوم
  static findBestDay(sales) {
    const days = {};
    
    sales.forEach(sale => {
      const day = moment(sale.sale_date).format('dddd');
      days[day] = (days[day] || 0) + parseFloat(sale.final_amount);
    });

    let bestDay = '';
    let maxRevenue = 0;
    
    Object.keys(days).forEach(day => {
      if (days[day] > maxRevenue) {
        maxRevenue = days[day];
        bestDay = day;
      }
    });

    // تحويل اليوم إلى عربي
    const daysMap = {
      'Sunday': 'الأحد',
      'Monday': 'الإثنين',
      'Tuesday': 'الثلاثاء',
      'Wednesday': 'الأربعاء',
      'Thursday': 'الخميس',
      'Friday': 'الجمعة',
      'Saturday': 'السبت'
    };

    return {
      day: daysMap[bestDay] || bestDay,
      revenue: maxRevenue.toFixed(3),
      percentage: (maxRevenue / sales.reduce((sum, sale) => sum + parseFloat(sale.final_amount), 0) * 100).toFixed(2)
    };
  }

  // تحليل طرق الدفع
  static analyzePaymentMethods(sales) {
    const methods = {};
    
    sales.forEach(sale => {
      const method = sale.payment_method || 'cash';
      methods[method] = (methods[method] || 0) + parseFloat(sale.final_amount);
    });

    const total = Object.values(methods).reduce((sum, amount) => sum + amount, 0);
    
    return Object.keys(methods).map(method => ({
      method: this.translatePaymentMethod(method),
      amount: methods[method].toFixed(3),
      percentage: ((methods[method] / total) * 100).toFixed(2),
      count: sales.filter(s => s.payment_method === method).length
    }));
  }

  // ترجمة طريقة الدفع
  static translatePaymentMethod(method) {
    const translations = {
      'cash': 'نقداً',
      'card': 'بطاقة',
      'bank_transfer': 'تحويل بنكي',
      'credit': 'آجل'
    };
    return translations[method] || method;
  }
}

module.exports = SaleController;