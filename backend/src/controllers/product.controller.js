const Product = require('../models/products.model');
const { Op } = require('sequelize');

class ProductController {
  // إنشاء منتج جديد
  static async createProduct(req, res) {
    try {
      const {
        name,
        category,
        unit,
        purchase_price,
        selling_price,
        quantity,
        expiry_date,
        barcode,
        supplier_id
      } = req.body;

      // التحقق من البيانات
      if (!name || !purchase_price || !selling_price) {
        return res.status(400).json({
          success: false,
          message: 'الاسم وسعر الشراء والبيع مطلوبة'
        });
      }

      // حساب الربح التلقائي
      const profit = selling_price - purchase_price;
      const profit_percentage = (profit / purchase_price * 100).toFixed(2);

      const product = await Product.create({
        name,
        category: category || 'عام',
        unit: unit || 'قطعة',
        purchase_price: parseFloat(purchase_price),
        selling_price: parseFloat(selling_price),
        quantity: parseFloat(quantity) || 0,
        expiry_date: expiry_date || null,
        barcode: barcode || null,
        supplier_id: supplier_id || null,
        created_by: req.user.id
      });

      res.status(201).json({
        success: true,
        message: 'تم إنشاء المنتج بنجاح',
        data: {
          ...product.toJSON(),
          profit,
          profit_percentage
        }
      });
    } catch (error) {
      console.error('خطأ في إنشاء المنتج:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في الخادم',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // جلب جميع المنتجات مع فلترة
  static async getProducts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        search,
        low_stock,
        expiring_soon,
        sort_by = 'createdAt',
        sort_order = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;
      const where = { is_active: true };

      // تطبيق الفلاتر
      if (category) where.category = category;
      
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { barcode: { [Op.like]: `%${search}%` } }
        ];
      }

      if (low_stock === 'true') {
        where.quantity = { [Op.lte]: { [Op.col]: 'min_quantity' } };
      }

      if (expiring_soon === 'true') {
        where.expiry_date = {
          [Op.between]: [
            new Date(),
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          ]
        };
      }

      const { count, rows } = await Product.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[sort_by, sort_order.toUpperCase()]]
      });

      // حساب الإحصائيات
      const totalValue = rows.reduce((sum, product) => {
        return sum + (parseFloat(product.quantity) * parseFloat(product.purchase_price));
      }, 0);

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        },
        statistics: {
          total_products: count,
          total_stock_value: totalValue.toFixed(3),
          low_stock_count: await Product.count({ where: { quantity: { [Op.lte]: { [Op.col]: 'min_quantity' } } } })
        }
      });
    } catch (error) {
      console.error('خطأ في جلب المنتجات:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في الخادم'
      });
    }
  }

  // تحديث المنتج
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const product = await Product.findByPk(id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'المنتج غير موجود'
        });
      }

      await product.update(updates);

      res.json({
        success: true,
        message: 'تم تحديث المنتج بنجاح',
        data: product
      });
    } catch (error) {
      console.error('خطأ في تحديث المنتج:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في الخادم'
      });
    }
  }

  // جلب تقرير المنتجات
  static async getProductReport(req, res) {
    try {
      const { start_date, end_date, category } = req.query;

      const where = { is_active: true };
      
      if (start_date && end_date) {
        where.createdAt = {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        };
      }

      if (category) where.category = category;

      const products = await Product.findAll({ where });

      // تحليل البيانات
      const analysis = {
        total_products: products.length,
        categories: {},
        top_profitable: [],
        low_profit: [],
        expiring_soon: [],
        total_investment: 0,
        total_potential_profit: 0
      };

      products.forEach(product => {
        // التحليل حسب الفئة
        if (!analysis.categories[product.category]) {
          analysis.categories[product.category] = {
            count: 0,
            total_value: 0
          };
        }
        analysis.categories[product.category].count++;
        analysis.categories[product.category].total_value += 
          parseFloat(product.quantity) * parseFloat(product.purchase_price);

        // حساب إجمالي الاستثمار والربح
        const stockValue = parseFloat(product.quantity) * parseFloat(product.purchase_price);
        const potentialProfit = parseFloat(product.quantity) * 
          (parseFloat(product.selling_price) - parseFloat(product.purchase_price));
        
        analysis.total_investment += stockValue;
        analysis.total_potential_profit += potentialProfit;

        // المنتجات الأكثر ربحية
        const profitMargin = ((parseFloat(product.selling_price) - 
          parseFloat(product.purchase_price)) / parseFloat(product.purchase_price)) * 100;
        
        if (profitMargin > 30) {
          analysis.top_profitable.push({
            name: product.name,
            profit_margin: profitMargin.toFixed(2),
            stock_value: stockValue.toFixed(3)
          });
        }

        // المنتجات قليلة الربح
        if (profitMargin < 10) {
          analysis.low_profit.push({
            name: product.name,
            profit_margin: profitMargin.toFixed(2),
            selling_price: product.selling_price
          });
        }

        // المنتجات القريبة من الانتهاء
        if (product.expiry_date) {
          const daysToExpiry = Math.floor(
            (new Date(product.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
          );
          if (daysToExpiry <= 7) {
            analysis.expiring_soon.push({
              name: product.name,
              expiry_date: product.expiry_date,
              days_left: daysToExpiry,
              quantity: product.quantity
            });
          }
        }
      });

      // ترتيب النتائج
      analysis.top_profitable.sort((a, b) => b.profit_margin - a.profit_margin);
      analysis.low_profit.sort((a, b) => a.profit_margin - b.profit_margin);
      analysis.expiring_soon.sort((a, b) => a.days_left - b.days_left);

      res.json({
        success: true,
        data: analysis,
        summary: {
          total_investment: analysis.total_investment.toFixed(3),
          total_potential_profit: analysis.total_potential_profit.toFixed(3),
          roi_percentage: ((analysis.total_potential_profit / analysis.total_investment) * 100).toFixed(2)
        }
      });
    } catch (error) {
      console.error('خطأ في إنشاء التقرير:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في إنشاء التقرير'
      });
    }
  }
}

module.exports = ProductController;