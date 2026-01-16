class AIEngine {
  constructor(database) {
    this.db = database;
    this.rules = {
      min_profit_margin: 15, // نسبة الربح الدنيا
      max_stock_days: 30,    // الحد الأقصى لأيام التخزين
      warning_days: 7,       // أيام التحذير قبل الانتهاء
      low_stock_threshold: 0.2 // نسبة المخزون المنخفض
    };
  }

  // تحليل الربح
  async analyzeProfit(startDate, endDate) {
    try {
      const sales = await this.db.Sale.findAll({
        where: {
          sale_date: { $between: [startDate, endDate] }
        },
        include: [{ model: this.db.SaleItem, include: [this.db.Product] }]
      });

      let totalRevenue = 0;
      let totalCost = 0;
      let profitByCategory = {};
      let topProducts = [];
      let bottomProducts = [];

      sales.forEach(sale => {
        sale.SaleItems.forEach(item => {
          const revenue = item.quantity * item.selling_price;
          const cost = item.quantity * item.Product.purchase_price;
          const profit = revenue - cost;
          
          totalRevenue += revenue;
          totalCost += cost;
          
          // تحليل حسب الفئة
          const category = item.Product.category;
          if (!profitByCategory[category]) {
            profitByCategory[category] = { revenue: 0, cost: 0, profit: 0 };
          }
          profitByCategory[category].revenue += revenue;
          profitByCategory[category].cost += cost;
          profitByCategory[category].profit += profit;
          
          // تحليل المنتجات
          topProducts.push({
            product: item.Product.name,
            profit: profit,
            quantity: item.quantity
          });
        });
      });

      // تحليل الأسباب المحتملة
      const analysis = {
        total_profit: totalRevenue - totalCost,
        profit_margin: ((totalRevenue - totalCost) / totalRevenue * 100).toFixed(2),
        by_category: profitByCategory,
        suggestions: []
      };

      // توليد اقتراحات
      if (analysis.profit_margin < this.rules.min_profit_margin) {
        analysis.suggestions.push({
          type: 'warning',
          title: 'هامش ربح منخفض',
          message: `هامش الربح الحالي ${analysis.profit_margin}% أقل من الحد الأدنى الموصى به ${this.rules.min_profit_margin}%`,
          actions: [
            'مراجعة أسعار البيع',
            'تفاوض مع الموردين لخفض أسعار الشراء',
            'تركيز على المنتجات ذات الهامش الأعلى'
          ]
        });
      }

      // تحليل المنتجات
      topProducts.sort((a, b) => b.profit - a.profit);
      analysis.top_performing = topProducts.slice(0, 5);
      analysis.bottom_performing = topProducts.slice(-5).reverse();

      return analysis;
    } catch (error) {
      console.error('خطأ في تحليل الربح:', error);
      throw error;
    }
  }

  // تحليل المخزون
  async analyzeInventory() {
    try {
      const products = await this.db.Product.findAll({
        where: { is_active: true }
      });

      const analysis = {
        total_products: products.length,
        total_investment: 0,
        categories: {},
        warnings: [],
        suggestions: []
      };

      products.forEach(product => {
        const stockValue = product.quantity * product.purchase_price;
        analysis.total_investment += stockValue;
        
        // تحليل الفئات
        if (!analysis.categories[product.category]) {
          analysis.categories[product.category] = {
            count: 0,
            value: 0,
            items: []
          };
        }
        analysis.categories[product.category].count++;
        analysis.categories[product.category].value += stockValue;
        analysis.categories[product.category].items.push(product.name);
        
        // تحقق من المخزون المنخفض
        const stockRatio = product.quantity / product.min_quantity;
        if (stockRatio < this.rules.low_stock_threshold) {
          analysis.warnings.push({
            type: 'low_stock',
            product: product.name,
            current: product.quantity,
            minimum: product.min_quantity,
            urgency: 'عاجل',
            message: `المخزون منخفض جداً: ${product.quantity} ${product.unit} فقط متبقية`
          });
        }
        
        // تحقق من تاريخ الانتهاء
        if (product.expiry_date) {
          const daysToExpiry = Math.floor(
            (new Date(product.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
          );
          if (daysToExpiry <= this.rules.warning_days) {
            analysis.warnings.push({
              type: 'expiry',
              product: product.name,
              expiry_date: product.expiry_date,
              days_left: daysToExpiry,
              urgency: daysToExpiry <= 3 ? 'عاجل جداً' : 'عاجل',
              message: `المنتج سينتهي خلال ${daysToExpiry} أيام`
            });
          }
        }
        
        // تحقق من نسبة الربح
        const profitMargin = ((product.selling_price - product.purchase_price) / product.purchase_price * 100);
        if (profitMargin < 0) {
          analysis.warnings.push({
            type: 'loss',
            product: product.name,
            purchase_price: product.purchase_price,
            selling_price: product.selling_price,
            loss_per_unit: product.purchase_price - product.selling_price,
            message: 'تبيع هذا المنتج بخسارة!'
          });
        }
      });

      // توليد اقتراحات
      if (analysis.warnings.length > 0) {
        analysis.suggestions.push({
          title: 'الإجراءات الفورية المطلوبة',
          items: analysis.warnings.map(w => w.message)
        });
      }

      // اقتراحات تحسين المخزون
      const slowMoving = products.filter(p => {
        const stockDays = p.quantity * 30 / 10; // افتراض مبيعات يومية
        return stockDays > this.rules.max_stock_days;
      });

      if (slowMoving.length > 0) {
        analysis.suggestions.push({
          title: 'منتجات بطيئة الحركة',
          message: `يوجد ${slowMoving.length} منتج بطيء الحركة`,
          items: slowMoving.map(p => `${p.name} (${p.quantity} ${p.unit} - ${(p.quantity * 30 / 10).toFixed(0)} يوم مخزون)`)
        });
      }

      return analysis;
    } catch (error) {
      console.error('خطأ في تحليل المخزون:', error);
      throw error;
    }
  }

  // مستشار الذكاء الاصطناعي
  async getAdvice(question, context = {}) {
    try {
      const responses = {
        'ربح': await this.analyzeProfit(context.startDate, context.endDate),
        'مخزون': await this.analyzeInventory(),
        'توصيات': await this.getRecommendations(),
        'تحليل': await this.getFullAnalysis()
      };

      // البحث عن الكلمات المفتاحية في السؤال
      const keywords = Object.keys(responses);
      const foundKeyword = keywords.find(keyword => 
        question.includes(keyword) || 
        this.arabicSynonyms(keyword).some(syn => question.includes(syn))
      );

      if (foundKeyword) {
        return {
          question,
          answer: responses[foundKeyword],
          type: foundKeyword,
          timestamp: new Date()
        };
      }

      // رد افتراضي
      return {
        question,
        answer: {
          message: 'أنا هنا لمساعدتك في تحليل متجرك. يمكنني مساعدتك في:',
          options: [
            'تحليل الربح والخسارة',
            'مراقبة المخزون',
            'تحديد المنتجات الأكثر ربحية',
            'تحذيرك من المنتجات المنتهية',
            'اقتراح كميات الشراء المناسبة'
          ],
          suggestion: 'اسألني: "كيف يمكنني زيادة ربح متجري؟" أو "ما هي المنتجات التي تسبب خسارة؟"'
        },
        type: 'general',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('خطأ في المستشار:', error);
      throw error;
    }
  }

  // مرادفات عربية للكلمات المفتاحية
  arabicSynonyms(word) {
    const synonyms = {
      'ربح': ['أرباح', 'ربح', 'مكسب', 'ربحي', 'أرباح'],
      'مخزون': ['مخازن', 'بضاعة', 'بضائع', 'عرض', 'مخزون'],
      'توصيات': ['نصائح', 'اقتراحات', 'توجيهات', 'توصيات'],
      'تحليل': ['دراسة', 'تقرير', 'فحص', 'تحليل']
    };
    return synonyms[word] || [];
  }

  // توليد توصيات
  async getRecommendations() {
    const inventory = await this.analyzeInventory();
    const recommendations = [];
    
    if (inventory.warnings.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'المشاكل العاجلة',
        items: inventory.warnings.map(w => w.message)
      });
    }
    
    // توصيات التسعير
    const products = await this.db.Product.findAll();
    const pricingIssues = products.filter(p => {
      const margin = ((p.selling_price - p.purchase_price) / p.purchase_price * 100);
      return margin < 10 || margin > 100;
    });
    
    if (pricingIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'مراجعة الأسعار',
        message: 'بعض المنتجات تحتاج مراجعة في التسعير',
        items: pricingIssues.map(p => 
          `${p.name}: شراء ${p.purchase_price} بيع ${p.selling_price} (هامش ${((p.selling_price - p.purchase_price) / p.purchase_price * 100).toFixed(1)}%)`
        )
      });
    }
    
    return recommendations;
  }
}

module.exports = AIEngine;