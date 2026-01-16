const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/product.controller');
const { validateProduct } = require('../middlewares/validation');
const authMiddleware = require('../middlewares/auth');

// جميع المسارات تحتاج مصادقة
router.use(authMiddleware);

// CRUD operations
router.post('/', validateProduct, ProductController.createProduct);
router.get('/', ProductController.getProducts);
router.get('/reports', ProductController.getProductReport);
router.get('/:id', async (req, res) => {
  try {
    const product = await require('../models/products.model').findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});
router.put('/:id', validateProduct, ProductController.updateProduct);
router.delete('/:id', async (req, res) => {
  try {
    const product = await require('../models/products.model').findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }
    await product.update({ is_active: false });
    res.json({ success: true, message: 'تم إلغاء تنشيط المنتج بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// مسارات خاصة
router.get('/category/:category', async (req, res) => {
  try {
    const products = await require('../models/products.model').findAll({
      where: { 
        category: req.params.category,
        is_active: true 
      }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

router.get('/low-stock/alerts', async (req, res) => {
  try {
    const products = await require('../models/products.model').findAll({
      where: {
        quantity: { 
          [require('sequelize').Op.lte]: require('sequelize').col('min_quantity') 
        },
        is_active: true
      }
    });
    res.json({ 
      success: true, 
      data: products,
      count: products.length,
      message: products.length > 0 ? 
        `يوجد ${products.length} منتج يحتاج إلى إعادة تخزين` :
        'جميع المنتجات مخزنة بشكل جيد'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

router.get('/expiring-soon/alerts', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    const products = await require('../models/products.model').findAll({
      where: {
        expiry_date: {
          [require('sequelize').Op.between]: [new Date(), targetDate]
        },
        is_active: true
      },
      order: [['expiry_date', 'ASC']]
    });
    
    res.json({ 
      success: true, 
      data: products,
      count: products.length,
      warning: products.length > 0 ? 
        `يوجد ${products.length} منتج سينتهي خلال ${days} أيام` :
        'لا توجد منتجات قريبة من الانتهاء'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

module.exports = router;